"""MCP 入口（D-051）：协议握手、按权限列工具与模板、工具结果与原 HTTP 接口一致、限时下载链接、写入可重试。"""
from contextlib import closing, redirect_stdout
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import io
import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.parse import urlencode, urlsplit
import zipfile

from app import build
from domain import ValidationError
from server import make_handler
from server import client_admin, mcp_files
from tools.seed_samples import open_store, seed_listing_photos

ALL = ['listing:read', 'trading:write', 'collection:read', 'insight:read']


class McpTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.ids = seed_listing_photos(self.root)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(build(self.root)))
        threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': 0.04}, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.next_id = 0

    def token(self, name, *scopes):
        out = io.StringIO()
        with redirect_stdout(out):
            client_admin.main(['--data-dir', str(self.root), 'add', name, *[a for s in scopes for a in ('--scope', s)]])
        return out.getvalue().strip().splitlines()[-1]

    def http(self, method, path, body=None, token=None, headers=None):
        sent = {'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + token} if token else {}),
                **(headers or {})}
        with closing(HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)) as conn:
            conn.request(method, path, None if body is None else json.dumps(body), sent)
            response = conn.getresponse()
            return response.status, response.read(), dict(response.getheaders())

    def rpc(self, token, method, params=None, **headers):
        self.next_id += 1
        status, raw, _ = self.http('POST', '/mcp', {'jsonrpc': '2.0', 'id': self.next_id, 'method': method,
                                                    'params': params or {}}, token, headers)
        self.assertEqual(status, 200, raw[:300])
        reply = json.loads(raw)
        self.assertEqual(reply['id'], self.next_id)
        return reply

    def call(self, token, name, arguments):
        result = self.rpc(token, 'tools/call', {'name': name, 'arguments': arguments})['result']
        return result, json.loads(result['content'][0]['text']) if not result['isError'] else result['content'][0]['text']

    def test_handshake_auth_and_protocol_errors(self):
        message = {'jsonrpc': '2.0', 'id': 1, 'method': 'ping'}
        self.assertEqual(self.http('POST', '/mcp', message)[0], 404)          # no caller issued yet
        token = self.token('采购Agent', 'insight:read')
        self.assertEqual(self.http('POST', '/mcp', message)[0], 401)
        self.assertEqual(self.http('POST', '/mcp', message, 'obi_client_' + 'x' * 43)[0], 401)
        self.assertEqual(self.http('GET', '/mcp', token=token)[0], 405)
        self.assertEqual(self.http('POST', '/mcp', message, token, {'Origin': 'https://evil.test'})[0], 403)
        init = self.rpc(token, 'initialize', {'protocolVersion': '2025-06-18', 'capabilities': {},
                                               'clientInfo': {'name': 'test', 'version': '1'}})['result']
        self.assertEqual((init['protocolVersion'], init['serverInfo']['name']), ('2025-06-18', 'obi'))
        self.assertEqual(set(init['capabilities']), {'tools', 'prompts'})
        self.assertEqual(self.rpc(token, 'initialize', {'protocolVersion': '1999-01-01'})['result']['protocolVersion'],
                         '2025-06-18')
        status, raw, _ = self.http('POST', '/mcp', {'jsonrpc': '2.0', 'method': 'notifications/initialized'}, token)
        self.assertEqual((status, raw), (202, b''))
        self.assertEqual(self.rpc(token, 'ping')['result'], {})
        self.assertEqual(self.rpc(token, 'resources/list')['error']['code'], -32601)
        self.assertEqual(self.rpc(token, 'tools/call', {'name': 'nope'})['error']['code'], -32602)
        bad = self.http('POST', '/mcp', message, token, {'MCP-Protocol-Version': '1999-01-01'})
        self.assertEqual(bad[0], 400)

    def test_tools_and_prompts_follow_scopes(self):
        buyer, full = self.token('采购Agent', 'insight:read'), self.token('全部', *ALL)
        names = lambda token: [t['name'] for t in self.rpc(token, 'tools/list')['result']['tools']]
        self.assertEqual(names(buyer), ['get_purchase_profile', 'evaluate_candidates'])
        self.assertEqual(len(names(full)), 8)
        tools = {t['name']: t for t in self.rpc(full, 'tools/list')['result']['tools']}
        self.assertTrue(tools['find_purchases']['annotations']['readOnlyHint'])
        self.assertTrue(tools['record_paid_order']['annotations']['idempotentHint'])
        self.assertFalse(tools['record_paid_order']['annotations']['readOnlyHint'])
        prompts = lambda token: [p['name'] for p in self.rpc(token, 'prompts/list')['result']['prompts']]
        self.assertEqual(prompts(buyer), ['purchase_scouting'])
        self.assertEqual(prompts(full), ['xianyu_listing', 'check_before_buying', 'purchase_scouting'])
        text = self.rpc(buyer, 'prompts/get', {'name': 'purchase_scouting', 'arguments': {'source': 'https://shop.test'}})
        body = text['result']['messages'][0]['content']['text']
        self.assertIn('https://shop.test', body)
        self.assertIn('evaluate_candidates', body)
        self.assertEqual(self.rpc(buyer, 'prompts/get', {'name': 'purchase_scouting'})['error']['code'], -32602)
        self.assertEqual(self.rpc(buyer, 'prompts/get', {'name': 'xianyu_listing',
                                                          'arguments': {'record': 'x'}})['error']['code'], -32602)
        result, text = self.call(buyer, 'record_paid_order', {})
        self.assertTrue(result['isError'])
        self.assertIn('trading:write', text)

    def test_read_tools_match_http(self):
        token = self.token('全部', *ALL)
        candidates = [{'ref': 'a', 'artist': 'Green Day', 'title': 'Dookie', 'format': 'CD', 'price': '120',
                       'currency': 'CNY'}]
        result, data = self.call(token, 'evaluate_candidates', {'candidates': candidates})
        self.assertEqual(result['structuredContent'], data)
        http = json.loads(self.http('POST', '/api/insight/evaluate', {'candidates': candidates}, token)[1])
        self.assertEqual(data['results'], http['results'])
        _, data = self.call(token, 'find_purchases', {'q': 'Dookie'})
        http = json.loads(self.http('GET', '/api/collection/purchases?q=Dookie', token=token)[1])
        self.assertEqual(data, http)
        _, profile = self.call(token, 'get_purchase_profile', {'halfLifeDays': 365})
        self.assertEqual(profile['weighting']['halfLifeDays'], 365)
        result, text = self.call(token, 'evaluate_candidates', {'candidates': []})
        self.assertTrue(result['isError'])
        self.assertIn('1–50', text)

    def test_listing_package_link_and_trading_writes(self):
        token = self.token('上架Agent', 'listing:read', 'trading:write')
        rid = self.ids['lift-fists']
        with closing(open_store(self.root).connect()) as db:
            record = open_store(self.root).get(db, 'records', rid)
        _, found = self.call(token, 'find_listing_copies', {'q': record['title']})
        self.assertIn(rid, [c['id'] for c in found['copies']])
        _, package = self.call(token, 'get_listing_package', {'id': rid})
        self.assertEqual(len(package['photos']), record['photoCount'])
        url = urlsplit(package['download']['url'])
        status, raw, headers = self.http('GET', f'{url.path}?{url.query}')            # no token needed
        self.assertEqual((status, headers['Content-Type']), (200, 'application/zip'))
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            materials = json.loads(archive.read('materials.json'))
        self.assertEqual((materials['revision'], materials['photoOrder']), (package['revision'], package['photoOrder']))
        self.assertEqual(self.http('GET', f'{url.path}?{url.query}x')[0], 403)
        self.assertEqual(self.http('GET', f'{url.path}?' + urlencode({'t': 'a.b'}))[0], 403)
        signed, _ = mcp_files.sign(rid, [], 0, now=0)
        with self.assertRaises(ValidationError):
            mcp_files.verify(signed)                                                  # expired

        receipt = {'id': rid, 'revision': package['revision'], 'itemId': '100000000001', 'status': 'online',
                   'price': '95.00', 'shipping': {'mode': 'free'}, 'verifiedAt': '2026-10-08T05:30:00Z'}
        first, again = self.call(token, 'record_listing_receipt', receipt)[1], self.call(token, 'record_listing_receipt', receipt)[1]
        self.assertTrue(first['listed'])
        self.assertEqual(first, again)
        result, text = self.call(token, 'record_listing_receipt', {**receipt, 'price': '96.00'})
        self.assertTrue(result['isError'])
        self.assertTrue(text.startswith('冲突'))
        order = {'orderId': 'DEMO-XIANYU-001', 'itemId': '100000000001', 'date': '2026-10-09', 'gross': '90.00'}
        self.assertEqual(self.call(token, 'record_paid_order', order)[1]['status'], 'shipping')
        _, done = self.call(token, 'record_settlement', {'orderId': 'DEMO-XIANYU-001', 'buyerReceived': True,
                                                         'settledDate': '2026-10-14'})
        self.assertEqual(done['status'], 'complete')


if __name__ == '__main__':
    unittest.main()
