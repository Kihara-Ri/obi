"""逐张二进制上传：先暂存、保存才关联；固定样本与本机模式共用契约。"""
import http.client
import json
import tempfile
import threading
import os
import time
import unittest
from contextlib import closing
from http.server import ThreadingHTTPServer
from pathlib import Path

from domain import ValidationError
from security import Auth
from server import Services, make_handler, local_entry
from tools.seed_samples import seed_listing_photos, open_store, model_sample_png
from tests.test_record_metadata import ForbiddenRates


class PhotoStagingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.folder = Path(self.tmp.name)
        self.ids = seed_listing_photos(self.folder)
        self.store = open_store(self.folder)
        self.store.rates = ForbiddenRates()
        self.svc = Services(store=self.store)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(self.svc))
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.raw = model_sample_png()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.tmp.cleanup()

    def request(self, path, raw, ctype='application/octet-stream', **headers):
        client = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        client.request('POST', path, raw, {'Content-Type': ctype, **headers})
        response = client.getresponse(); status = response.status; body = response.read(); client.close()
        return status, json.loads(body)

    def row(self):
        with closing(self.store.connect()) as db:
            return self.store.get(db, 'records', self.ids['lift-fists'])

    def test_staging_is_idempotent_and_only_save_associates_the_photo(self):
        before = self.row(); token = 'a' * 32
        for _ in range(2):
            status, body = self.request('/api/photos/stage?token=' + token, self.raw)
            self.assertEqual(status, 200, body)
            self.assertEqual(body, {'ref': token, 'bytes': len(self.raw)})
        self.assertEqual(self.row(), before)
        status, body = self.request('/api/records/metadata', json.dumps({
            'id': before['id'], 'revision': before['revision'], 'photos': [0, {'upload': token}],
        }).encode(), 'application/json')
        self.assertEqual(status, 200, body)
        self.assertEqual(body['records'][0]['photoCount'], 2)
        self.assertEqual((self.store.photos_dir / before['id'] / '1.png').read_bytes(), self.raw)
        # 保留暂存引用，响应丢失后同 token 重传仍可确认，而不是重复上传一整批。
        self.assertEqual(self.request('/api/photos/stage?token=' + token, self.raw)[0], 200)

    def test_staging_rejects_bad_token_invalid_image_and_content_conflicts(self):
        self.assertEqual(self.request('/api/photos/stage?token=../x', self.raw)[0], 400)
        self.assertEqual(self.request('/api/photos/stage?token=' + 'b' * 32, b'not an image')[0], 400)
        self.assertEqual(self.request('/api/photos/stage?token=' + 'b' * 32, self.raw)[0], 200)
        self.assertEqual(self.request('/api/photos/stage?token=' + 'b' * 32, self.raw + b'different')[0], 400)

    def test_missing_reference_does_not_change_ledger_or_existing_photos(self):
        before = self.row()
        files = {p.name: p.read_bytes() for p in (self.store.photos_dir / before['id']).iterdir()}
        with self.assertRaises(ValidationError):
            self.store.save({'id': before['id'], 'revision': before['revision'],
                             'photos': [{'upload': 'f' * 32}]}, metadata_only=True)
        self.assertEqual(self.row(), before)
        self.assertEqual({p.name: p.read_bytes() for p in (self.store.photos_dir / before['id']).iterdir()}, files)

    def test_upload_requires_login_and_rejects_cross_site(self):
        self.svc.auth = Auth(self.folder / 'test-auth.sqlite3')
        self.svc.auth.set_password('fixture-password-123')
        path = '/api/photos/stage?token=' + 'c' * 32
        self.assertEqual(self.request(path, self.raw)[0], 401)
        self.assertEqual(self.request(path, self.raw, Origin='https://evil.test')[0], 403)

    def test_local_engine_uses_the_same_staging_route(self):
        engine = local_entry.Engine(self.folder, seed=False)
        token = 'd' * 32
        status, _, body = engine.handle('POST', '/api/photos/stage?token=' + token, '{}', self.raw)
        self.assertEqual(status, 200, body)
        self.assertEqual(json.loads(body)['ref'], token)

    def test_expired_staging_cannot_save_and_is_cleaned_by_next_upload(self):
        token = 'e' * 32
        self.assertEqual(self.request('/api/photos/stage?token=' + token, self.raw)[0], 200)
        path = self.folder / '.photo-uploads' / token
        os.utime(path, (time.time() - 90000, time.time() - 90000))
        before = self.row()
        with self.assertRaises(ValidationError):
            self.store.prepare_photos(before['id'], [{'upload': token}])
        self.assertEqual(self.request('/api/photos/stage?token=' + 'f' * 32, self.raw)[0], 200)
        self.assertFalse(path.exists())
        self.assertEqual(self.row(), before)

    def test_size_limit_rejects_before_reading_body(self):
        client = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        client.putrequest('POST', '/api/photos/stage?token=' + 'a' * 32)
        client.putheader('Content-Type', 'application/octet-stream')
        client.putheader('Content-Length', str(8 * 1024 * 1024 + 1)); client.endheaders()
        response = client.getresponse()
        self.assertEqual(response.status, 413)
        self.assertIn('8 MB', json.loads(response.read())['error']); client.close()

