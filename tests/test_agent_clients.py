"""调用方令牌（D-050）：按权限授权、热加载、失败即关闭，旧令牌文件行为不变，管理脚本可迁移。"""
from contextlib import closing, redirect_stdout
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
import secrets
import tempfile
import threading
import unittest

from app import build
from server import make_handler
from server import agent_clients as ac
from server import client_admin as obi_client
from tools.seed_samples import seed_purchase_review

PURCHASES = '/api/collection/purchases?q=Dookie'
PACKAGE = '/api/listing/agent/package?q=Dookie'


class ClientTokenTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        seed_purchase_review(self.root)
        self.services = build(self.root)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(self.services))
        threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': 0.04}, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def cli(self, *args):
        out = io.StringIO()
        with redirect_stdout(out):
            obi_client.main(['--data-dir', str(self.root), *args])
        return out.getvalue()

    def add(self, name, *scopes):
        out = self.cli('add', name, *[x for s in scopes for x in ('--scope', s)])
        return out.strip().splitlines()[-1]

    def request(self, path, token=None, body=None):
        headers = {'Content-Type': 'application/json'}
        if token is not None:
            headers['Authorization'] = 'Bearer ' + token
        with closing(HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)) as conn:
            conn.request('GET' if body is None else 'POST', path, body, headers)
            response = conn.getresponse()
            return response.status, json.loads(response.read())

    def test_scopes_without_restart(self):
        self.assertEqual(self.request(PURCHASES)[0], 404)          # nothing grants collection:read yet
        buyer = self.add('采购Agent', 'collection:read')
        self.assertTrue(ac.TOKEN_RE.fullmatch(buyer))
        self.assertEqual(self.request(PURCHASES, buyer)[0], 200)
        self.assertEqual(self.request(PURCHASES, 'obi_client_' + 'x' * 43)[0], 401)
        self.assertEqual(self.request(PURCHASES)[0], 401)
        lister = self.add('上架Agent', 'listing:read')
        status, data = self.request(PURCHASES, lister)
        self.assertEqual(status, 403)
        self.assertIn('collection:read', data['error'])
        self.assertEqual(self.request('/api/trading/agent/orders', buyer, body='{}')[0], 404)
        self.assertEqual(self.request(PACKAGE, buyer)[0], 403)
        self.assertEqual(self.request('/api/state', buyer)[0], 401)   # never a browser session

        self.cli('scopes', '上架Agent', 'listing:read', 'collection:read')
        self.assertEqual(self.request(PURCHASES, lister)[0], 200)
        fresh = self.cli('rotate', '采购Agent').strip().splitlines()[-1]
        self.assertEqual(self.request(PURCHASES, buyer)[0], 401)
        self.assertEqual(self.request(PURCHASES, fresh)[0], 200)
        self.cli('revoke', '采购Agent')
        self.assertEqual(self.request(PURCHASES, fresh)[0], 401)

    def test_file_is_hashed_private_and_fails_closed(self):
        token = self.add('采购Agent', 'collection:read')
        path = ac.clients_path(self.root)
        self.assertEqual(os.stat(path).st_mode & 0o777, 0o600)
        self.assertNotIn(token, path.read_text())
        path.write_text('{"version": 1, "clients": [{"name": "x"}]}')
        self.assertEqual(self.request(PURCHASES, token)[0], 404)
        with self.assertRaises(SystemExit):
            self.cli('list')

    def test_cli_rejects_bad_input(self):
        self.add('采购Agent', 'collection:read')
        for args in (('add', '采购Agent', '--scope', 'collection:read'), ('add', ' ', '--scope', 'insight:read'),
                     ('revoke', '不存在'), ('scopes', '不存在', 'insight:read')):
            with self.assertRaises(SystemExit, msg=args), redirect_stdout(io.StringIO()):
                self.cli(*args)

    def test_legacy_files_keep_behaviour_and_import_keeps_token(self):
        credentials = self.root / 'credentials'
        credentials.mkdir(mode=0o700, exist_ok=True)
        legacy = 'obi_collection_' + secrets.token_urlsafe(32)
        (credentials / 'collection-read.token').write_text(legacy + '\n')
        self.services.collection_read_secret = build(self.root).collection_read_secret
        lister = self.add('上架Agent', 'listing:read')
        self.assertEqual(self.request(PURCHASES, legacy)[0], 200)
        self.assertEqual(self.request(PACKAGE, legacy)[0], 401)       # legacy token never gains other scopes

        self.assertIn('已迁移：collection-read.token', self.cli('import-legacy'))
        self.assertIn('没有需要迁移', self.cli('import-legacy'))
        (credentials / 'collection-read.token').unlink()
        self.services.collection_read_secret = None                   # restart without the old file
        self.assertEqual(self.request(PURCHASES, legacy)[0], 200)
        self.assertEqual(self.request(PURCHASES, lister)[0], 403)
        self.assertIn('旧令牌 collection-read\tcollection:read', self.cli('list'))


if __name__ == '__main__':
    unittest.main()
