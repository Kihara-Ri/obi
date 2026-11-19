"""真实 HTTP 入口：会话、跨站保护、草稿不标记上架和 ZIP 下载。"""
import io
import json
import tempfile
import threading
import unittest
import zipfile
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from server import Services, make_handler
from security import Auth
from tools.seed_samples import seed_listing_photos, open_store


class ListingRouteTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.ids = seed_listing_photos(self.tmp.name)
        self.store = open_store(self.tmp.name)
        self.auth = Auth(Path(self.tmp.name) / 'auth.sqlite3')
        self.auth.set_password('listing-test-password')
        self.token = self.auth.login('listing-test-password', '127.0.0.1')
        self.services = Services(store=self.store, auth=self.auth)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(self.services))
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.tmp.cleanup()

    def request(self, path, data=None, login=True, origin=None):
        conn = HTTPConnection('127.0.0.1', self.server.server_port)
        headers = {'Content-Type': 'application/json'}
        if login: headers['Cookie'] = 'album_session=' + self.token
        if origin: headers['Origin'] = origin
        conn.request('GET' if data is None else 'POST', path, json.dumps(data) if data is not None else None, headers)
        response = conn.getresponse(); raw = response.read(); status = response.status
        conn.close()
        return status, raw

    def test_private_zip_and_draft_are_guarded_and_leave_listed_unchanged(self):
        with self.store.connect() as db: r = self.store.get(db, 'records', self.ids['lift-fists'])
        path = f"/api/listing/photos?id={r['id']}&order=1,0&photoRevision={r['photoRevision']}"
        self.assertEqual(self.request(path, login=False)[0], 401)
        status, raw = self.request(path)
        self.assertEqual(status, 200)
        label = f"{r['artist']} - {r['title']}"
        with zipfile.ZipFile(io.BytesIO(raw)) as archive: self.assertEqual(archive.namelist(), [f'{label} - 01.png', f'{label} - 02.png'])
        body = {'id': r['id'], 'revision': r['revision'], 'draft': {
            'title': '标题', 'description': '描述', 'photoOrder': [1, 0], 'photoRevision': r['photoRevision'],
            'versionConfirmed': False, 'conditionConfirmed': False}}
        self.assertEqual(self.request('/api/listing/draft', body, origin='https://other.test')[0], 403)
        self.assertEqual(self.request('/api/listing/draft', body)[0], 200)
        with self.store.connect() as db: updated = self.store.get(db, 'records', r['id'])
        self.assertEqual(updated.get('listed'), r.get('listed'))
        self.assertEqual(updated['listingDraft']['title'], '标题')
        self.assertEqual(self.request('/api/listing/draft', body)[0], 400)

    def test_generation_and_preferences_share_auth_csrf_and_module_guards(self):
        self.assertEqual(self.request('/api/listing/preferences', login=False)[0], 401)
        status, raw = self.request('/api/listing/preferences')
        self.assertEqual(status, 200)
        preferences = json.loads(raw)
        self.assertEqual(preferences['defaultPreset'], 'concise')
        self.assertEqual(len(preferences['builtins']), 3)
        self.assertEqual(self.request('/api/listing/preferences', preferences, origin='https://other.test')[0], 403)
        self.assertEqual(self.request('/api/listing/preferences', preferences)[0], 200)
        self.assertEqual(self.request('/api/listing/preferences', preferences)[0], 400)
        self.assertEqual(self.request('/api/listing/generate', {}, login=False)[0], 401)
        self.assertEqual(self.request('/api/listing/generate', {}, origin='https://other.test')[0], 403)
        self.store.set_modules(dict(acquisition=True, trading=False, circulation=True, showcase=True))
        self.assertEqual(self.request('/api/listing/preferences')[0], 400)
        self.assertEqual(self.request('/api/listing/generate', {})[0], 400)

    def test_photo_copy_fetch_rejects_stale_revision(self):
        with self.store.connect() as db: r = self.store.get(db, 'records', self.ids['lift-fists'])
        path = f"/api/photo/{r['id']}/0"
        self.assertEqual(self.request(path + f"?photoRevision={r['photoRevision']}")[0], 200)
        self.assertEqual(self.request(path + f"?photoRevision={r['photoRevision'] + 1}")[0], 400)
        self.assertEqual(self.request(path + '?photoRevision=invalid')[0], 400)
        self.assertEqual(self.request(path)[0], 200)

    def test_photo_cache_only_for_versioned_url(self):
        with self.store.connect() as db: r = self.store.get(db, 'records', self.ids['lift-fists'])
        path = f"/api/photo/{r['id']}/0"
        conn = HTTPConnection('127.0.0.1', self.server.server_port)
        for url, cache in ((path + f"?photoRevision={r['photoRevision']}", 'private, max-age=31536000, immutable'), (path, 'no-store')):
            conn.request('GET', url, headers={'Cookie': 'album_session=' + self.token})
            response = conn.getresponse(); response.read()
            self.assertEqual((response.status, response.getheader('Cache-Control')), (200, cache))
        conn.close()

    def test_listing_job_query_by_record_id(self):
        from unittest.mock import MagicMock
        mock_listings = MagicMock()
        mock_listings.status.return_value = {'status': 'idle'}
        self.services.listings = mock_listings
        status, raw = self.request('/api/listing/job?recordId=r1')
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw), {'status': 'idle'})
        mock_listings.status.assert_called_once_with(ident='', record_id='r1')
