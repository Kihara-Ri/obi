"""真实 HTTP 入口：会话、跨站保护、草稿不标记上架和 ZIP 下载。"""
import io
import json
import secrets
import tempfile
import threading
import unittest
import zipfile
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from server import Services, make_handler
from server.listing_agent import load_agent_secret
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

    def request(self, path, data=None, login=True, origin=None, agent=None):
        conn = HTTPConnection('127.0.0.1', self.server.server_port)
        headers = {'Content-Type': 'application/json'}
        if login: headers['Cookie'] = 'album_session=' + self.token
        if origin: headers['Origin'] = origin
        if agent: headers['Authorization'] = 'Bearer ' + agent
        conn.request('GET' if data is None else 'POST', path, json.dumps(data) if data is not None else None, headers)
        response = conn.getresponse(); raw = response.read(); status = response.status
        conn.close()
        return status, raw

    def enable_agent(self):
        directory = Path(self.tmp.name) / 'credentials'
        directory.mkdir()
        token = 'obi_listing_' + secrets.token_urlsafe(32)
        (directory / 'listing-agent.token').write_text(token + '\n')
        self.services.listing_agent_secret = load_agent_secret(directory.parent)
        return token

    def test_agent_access_is_opt_in_and_does_not_grant_session_access(self):
        copies = '/api/listing/agent/copies?q=Dookie'
        self.assertEqual(self.request(copies)[0], 404)
        token = self.enable_agent()
        self.assertEqual(self.request(copies)[0], 401)
        self.assertEqual(self.request(copies, login=False, agent='wrong')[0], 401)
        self.assertEqual(self.request(copies, login=False, agent=token, origin='https://other.test')[0], 403)
        self.assertEqual(self.request(copies, login=False, agent=token)[0], 200)
        self.assertEqual(self.request('/api/state', login=False, agent=token)[0], 401)
        self.assertEqual(self.request('/api/listing/draft', {}, login=False, agent=token)[0], 401)
        self.store.set_modules(dict(acquisition=True, trading=False, circulation=True, showcase=True))
        self.assertEqual(self.request(copies, login=False, agent=token)[0], 400)

    def test_agent_search_returns_copy_candidates_and_matches_identifiers_exactly(self):
        options = {'login': False, 'agent': self.enable_agent()}
        path = '/api/listing/agent/copies'
        status, raw = self.request(path + '?q=Green+Day+Dookie', **options)
        self.assertEqual(status, 200)
        data = json.loads(raw)
        self.assertEqual({row['id'] for row in data['copies']},
                         {self.ids['dookie-jp'], self.ids['dookie-en']})
        self.assertIsNone(data['nextOffset'])
        status, raw = self.request(path + '?by=catalogNumber&q=wpcr0001', **options)
        self.assertEqual(status, 200)
        self.assertEqual([r['id'] for r in json.loads(raw)['copies']], [self.ids['dookie-jp']])
        status, raw = self.request(path + '?by=catalogNumber&q=wpcr', **options)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)['copies'], [])
        self.assertEqual(self.request(path, **options)[0], 400)

    def test_agent_materials_originals_and_guarded_draft_round_trip(self):
        options = {'login': False, 'agent': self.enable_agent()}
        rid = self.ids['lift-fists']
        base = '/api/listing/agent'
        materials = f'{base}/materials?id={rid}'
        status, raw = self.request(materials, **options)
        self.assertEqual(status, 200)
        data = json.loads(raw)
        self.assertEqual(data['writingPreset']['id'], 'concise')
        self.assertEqual(set(data['facts']), {'album', 'release', 'copy'})
        self.assertEqual(data['photoOrder'], [0, 1])
        self.assertIsNone(data['draft'])
        version = data['photoRevision']
        archive = f'{base}/photos?id={rid}&order=1&photoRevision='
        status, raw = self.request(archive + str(version), **options)
        self.assertEqual(status, 200)
        with zipfile.ZipFile(io.BytesIO(raw)) as bundle:
            original = self.request(f'/api/photo/{rid}/1?photoRevision={version}')[1]
            self.assertEqual([bundle.read(name) for name in bundle.namelist()], [original])
        self.assertEqual(self.request(archive + str(version + 1), **options)[0], 400)
        draft = {'id': rid, 'revision': data['revision'], 'photoRevision': version,
                 'title': '测试标题', 'description': '测试正文', 'photoOrder': [1]}
        target = f'{base}/draft'
        self.assertEqual(self.request(target, {**draft, 'markListed': True}, **options)[0], 400)
        status, raw = self.request(target, draft, **options)
        self.assertEqual(status, 200)
        new_revision = json.loads(raw)['revision']
        saved = json.loads(self.request(materials, **options)[1])
        self.assertEqual(saved['draft'], {'title': draft['title'], 'description': draft['description']})
        self.assertEqual(saved['photoOrder'], [1])
        self.assertEqual(saved['listed'], data['listed'])
        self.assertEqual(self.request(target, draft, **options)[0], 400)
        draft.update(revision=new_revision, title='替换后的标题')
        self.assertEqual(self.request(target, draft, **options)[0], 409)
        self.assertEqual(self.request(target, {**draft, 'replaceExisting': True}, **options)[0], 200)

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
