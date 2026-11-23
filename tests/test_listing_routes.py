"""资料包 HTTP 契约以及普通照片下载和历史资料的兼容。"""
import io
import json
import secrets
import tempfile
import threading
import unittest
import zipfile
from contextlib import closing
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlencode

from security import Auth
from server import Services, make_handler
from server.listing_agent import load_agent_secret
from tools.seed_samples import open_store, seed_legacy_listing_copy, seed_listing_photos


PACKAGE = '/api/listing/agent/package'


class ListingRouteTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        self.ids = seed_listing_photos(root)
        self.store = open_store(root)
        auth = Auth(root / 'auth.sqlite3')
        auth.set_password('sample-listing-package-password')
        self.session = auth.login('sample-listing-package-password', '127.0.0.1')
        credentials = root / 'credentials'
        credentials.mkdir()
        self.token = 'obi_listing_' + secrets.token_urlsafe(32)
        (credentials / 'listing-agent.token').write_text(self.token + '\n')
        self.services = Services(store=self.store, auth=auth, listing_agent_secret=load_agent_secret(root))
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(self.services))
        threading.Thread(target=self.server.serve_forever, daemon=True, kwargs={'poll_interval': 0.04}).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def request(self, path, data=None, *, agent=None, browser=False, origin=None):
        headers = {'Content-Type': 'application/json'}
        if agent:
            headers['Authorization'] = 'Bearer ' + agent
        if browser:
            headers['Cookie'] = 'album_session=' + self.session
        if origin:
            headers['Origin'] = origin
        with closing(HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)) as conn:
            conn.request('GET' if data is None else 'POST', path,
                         json.dumps(data) if data is not None else None, headers)
            response = conn.getresponse()
            return response.status, response.read(), dict(response.getheaders())

    def package(self, **params):
        status, raw, headers = self.request(PACKAGE + '?' + urlencode(params), agent=self.token)
        self.assertEqual(status, 200, raw[:250] if status != 200 else '')
        self.assertEqual(headers['Content-Type'], 'application/zip')
        self.assertEqual(headers['Cache-Control'], 'no-store')
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            manifest = json.loads(archive.read('materials.json'))
            photos = [archive.read(row['file']) for row in manifest['photos']]
            self.assertEqual(set(archive.namelist()), {'materials.json', *(row['file'] for row in manifest['photos'])})
        return manifest, photos

    def test_token_is_read_only_and_retired_routes_are_absent(self):
        search = PACKAGE + '?q=Dookie'
        self.assertEqual(self.request(search)[0], 401)
        self.assertEqual(self.request(search, browser=True)[0], 401)
        self.assertEqual(self.request(search, agent='wrong')[0], 401)
        self.assertEqual(self.request(search, agent=self.token, origin='https://other.test')[0], 403)
        self.assertEqual(self.request('/api/state', agent=self.token)[0], 401)
        self.assertEqual(self.request('/api/listing/agent/receipts', {}, agent=self.token)[0], 404)
        for path in ('/api/listing/status', '/api/listing/agent/copies', '/api/listing/agent/materials',
                     '/api/listing/agent/photos', '/api/listing/photos'):
            self.assertEqual(self.request(path, browser=True)[0], 404)
        for path in ('/api/listing/generate', '/api/listing/draft', '/api/listing/agent/draft'):
            self.assertEqual(self.request(path, {}, browser=True)[0], 404)
        self.services.listing_agent_secret = None
        self.assertEqual(self.request(search, agent=self.token)[0], 404)

    def test_search_preserves_disambiguation_and_exact_catalog_numbers(self):
        _, data, _ = self.request(PACKAGE + '?q=Green+Day+Dookie', agent=self.token)
        self.assertEqual({row['id'] for row in json.loads(data)['copies']},
                         {self.ids['dookie-jp'], self.ids['dookie-en']})
        _, data, _ = self.request(PACKAGE + '?by=catalogNumber&q=wpcr0001', agent=self.token)
        self.assertEqual([r['id'] for r in json.loads(data)['copies']], [self.ids['dookie-jp']])
        _, data, _ = self.request(PACKAGE + '?by=catalogNumber&q=wpcr', agent=self.token)
        self.assertEqual(json.loads(data)['copies'], [])
        self.assertEqual(self.request(PACKAGE, agent=self.token)[0], 400)
        self.assertEqual(self.request(PACKAGE + '?id=bad&q=a', agent=self.token)[0], 400)

    def test_package_preserves_historical_photo_order_and_original_bytes(self):
        rid = self.ids['lift-fists']
        manifest, original = self.package(id=rid)
        self.assertNotIn('draft', manifest)
        self.assertEqual(set(manifest['facts']), {'album', 'release', 'copy'})
        self.assertEqual(manifest['photoOrder'], [0, 1])
        version = manifest['photoRevision']
        seed_legacy_listing_copy(self.store.path.parent)
        self.store.migrate()
        old, archive = self.package(id=rid)
        self.assertNotIn('draft', old)
        self.assertEqual(old['photos'], [{'index': 1, 'file': 'photos/01.png'}, {'index': 0, 'file': 'photos/02.png'}])
        self.assertEqual(archive, original[::-1])
        selected, subset = self.package(id=rid, order='0', photoRevision=version)
        self.assertEqual(selected['photoOrder'], [0])
        self.assertEqual(subset, original[:1])
        metadata, empty = self.package(id=rid, photos='0')
        self.assertEqual((metadata['photoCount'], metadata['photoOrder'], empty), (2, [], []))
        self.assertFalse(metadata['listed'])
        self.assertEqual(self.request(PACKAGE + f'?id={rid}&order=0', agent=self.token)[0], 400)
        self.assertEqual(self.request(PACKAGE + f'?id={rid}&order=0&photoRevision={version + 1}',
                                      agent=self.token)[0], 409)

    def test_ordinary_photos_keep_auth_cache_and_work_without_trading(self):
        rid = self.ids['lift-fists']
        manifest, original = self.package(id=rid)
        version = manifest['photoRevision']
        self.store.set_modules(dict(acquisition=True, trading=False, circulation=True, showcase=True))
        self.assertEqual(self.request(PACKAGE + f'?id={rid}', agent=self.token)[0], 400)
        path = f'/api/photos/archive?id={rid}&order=0,1&photoRevision={version}'
        self.assertEqual(self.request(path)[0], 401)
        self.assertEqual(self.request(path, agent=self.token)[0], 401)
        status, raw, _ = self.request(path, browser=True)
        self.assertEqual(status, 200)
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            self.assertEqual([archive.read(name) for name in archive.namelist()], original)
        plain = f'/api/photo/{rid}/0'
        self.assertEqual(self.request(plain + f'?photoRevision={version + 1}', browser=True)[0], 400)
        for suffix, cache in (('', 'no-store'), (f'?photoRevision={version}', 'private, max-age=31536000, immutable')):
            status, raw, headers = self.request(plain + suffix, browser=True)
            self.assertEqual((status, raw, headers['Cache-Control']), (200, original[0], cache))
