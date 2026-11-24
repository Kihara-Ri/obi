"""网页端管理调用方令牌（D-052）：需登录与已设密码；签发的令牌能连 MCP，轮换与撤销立即生效。"""
from contextlib import closing
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading
import unittest

from app import build
from server import make_handler

PING = {'jsonrpc': '2.0', 'id': 1, 'method': 'ping'}


class ClientApiTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.services = build(self.root)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(self.services))
        threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': 0.04}, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.cookie = None

    def http(self, path, body=None, token=None):
        headers = {'Content-Type': 'application/json'}
        if self.cookie:
            headers['Cookie'] = self.cookie
        if token:
            headers['Authorization'] = 'Bearer ' + token
        with closing(HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)) as conn:
            conn.request('GET' if body is None else 'POST', path, None if body is None else json.dumps(body), headers)
            response = conn.getresponse()
            raw = response.read()
            return response.status, json.loads(raw) if raw else None, dict(response.getheaders())

    def login(self):
        self.services.auth.set_password('client-api-password-123')
        status, _, headers = self.http('/api/login', {'password': 'client-api-password-123'})
        self.assertEqual(status, 200)
        self.cookie = headers['Set-Cookie'].split(';')[0]

    def test_requires_login(self):
        self.assertEqual(self.http('/api/clients')[0], 401)                 # 未设密码：整站拒绝
        self.services.auth.set_password('client-api-password-123')
        self.assertEqual(self.http('/api/clients')[0], 401)
        self.assertEqual(self.http('/api/clients/issue', {'name': 'x', 'scopes': ['insight:read']})[0], 401)
        self.assertFalse((self.root / 'credentials' / 'clients.json').exists())

    def test_unavailable_without_registry(self):
        self.login()
        self.services.agent_clients = None
        status, data, _ = self.http('/api/clients')
        self.assertEqual((status, data['available']), (200, False))
        self.assertEqual(self.http('/api/clients/issue', {'name': 'x', 'scopes': ['insight:read']})[0], 400)

    def test_issue_rotate_scopes_revoke(self):
        self.login()
        status, data, _ = self.http('/api/clients')
        self.assertEqual((data['available'], data['clients'], data['path']), (True, [], '/mcp'))
        status, made, _ = self.http('/api/clients/issue', {'name': ' 采购 Agent ', 'scopes': ['insight:read']})
        self.assertEqual(status, 200)
        self.assertEqual((made['name'], made['clients'][0]['scopes']), ('采购 Agent', ['insight:read']))
        self.assertNotIn('sha256', made['clients'][0])
        token = made['token']
        self.cookie, saved = None, self.cookie
        self.assertEqual(self.http('/mcp', PING, token)[0], 200)
        self.cookie = saved
        self.assertEqual(self.http('/api/clients/issue', {'name': '采购 Agent', 'scopes': ['insight:read']})[0], 400)
        self.assertEqual(self.http('/api/clients/issue', {'name': 'y', 'scopes': ['root']})[0], 400)
        self.assertEqual(self.http('/api/clients/issue', {'name': 'y', 'scopes': []})[0], 400)

        _, data, _ = self.http('/api/clients/scopes', {'name': '采购 Agent',
                                                        'scopes': ['trading:write', 'insight:read']})
        self.assertEqual(data['clients'][0]['scopes'], ['trading:write', 'insight:read'])
        _, rotated, _ = self.http('/api/clients/rotate', {'name': '采购 Agent'})
        self.assertNotEqual(rotated['token'], token)
        self.assertEqual(self.http('/mcp', PING, token)[0], 401)
        self.assertEqual(self.http('/mcp', PING, rotated['token'])[0], 200)
        _, data, _ = self.http('/api/clients/revoke', {'name': '采购 Agent'})
        self.assertEqual(data['clients'], [])
        self.assertEqual(self.http('/api/clients/revoke', {'name': '采购 Agent'})[0], 400)
        self.assertEqual(self.http('/mcp', PING, rotated['token'])[0], 404)


if __name__ == '__main__':
    unittest.main()
