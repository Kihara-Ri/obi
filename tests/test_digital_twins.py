import base64
import copy
import tempfile
import threading
import json
import http.client
from http.server import ThreadingHTTPServer
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from domain import ValidationError
from storage import Store, uid
from server.digital_twins import DigitalTwinService
from server import Services, make_handler
from security import Auth
from twins import TWIN_KEY, clean_entity

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')
PHOTO = 'data:image/png;base64,' + base64.b64encode(PNG).decode()
EDITION = '11111111-1111-4111-8111-111111111111'
FULL = {'structure': 'gatefold', 'panels': 2, 'holder': 'pocket', 'pockets': 'both', 'pocketOpening': 'inner', 'discs': 2,
        'photos': {role: 0 for role in ('front', 'back', 'insideLeft', 'insideRight', 'disc', 'disc2')}}


class Model:
    def __init__(self): self.calls = 0
    def public_config(self): return {'configured': True}
    def catalog(self, _fields): return []
    def agent_json(self, _skill, instruction, images=(), on_start=None):
        if on_start: on_start()
        self.calls += 1
        if instruction.startswith('PLAN'): return {'sourceIds': ['photo:0']}
        return {'sameAlbum': True, 'packaging': {'structure': 'gatefold', 'discs': 2}, 'surfaces': {}, 'warnings': []}


class Metadata:
    def get(self, _path, _params):
        assert 'recordings' in _params['inc'], 'release lookup must request medium/recording details'
        return {'title': 'Test Album', 'artist-credit': [{'name': 'Test Artist'}], 'media': [{'format': 'CD'}, {'format': 'CD'}]}


class Art:
    def catalog(self, _edition): return {'images': []}


class DigitalTwinTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.store = Store(Path(self.tmp.name) / 'albums.sqlite3')
        self.store.set_modules({'showcase': True, 'acquisition': False, 'trading': False, 'circulation': False})
        self.rid = self.store.save({'title': 'Test Album', 'artist': 'Test Artist', 'photos': [PHOTO], 'packaging': FULL})['ids'][0]
        self.model = Model(); self.service = DigitalTwinService(self.store, self.model, Metadata(), Art())

    def tearDown(self): self.service.stop(); self.tmp.cleanup()
    def record(self): return next(r for r in self.store.state()['records'] if r['id'] == self.rid)
    def request(self, **patch): return {'recordId': self.rid, 'recordRevision': self.record()['revision'], 'requestId': uid(), 'releaseId': EDITION, **patch}
    def create(self, **patch): return self.store.start_twin(self.request(**patch))['job']
    def publish(self):
        job = self.create(); self.service.run_one(); return self.store.twin_index()['jobs'][self.rid]

    def test_concurrent_tabs_and_different_keys_create_one_task(self):
        bodies = [self.request() for _ in range(16)]
        with ThreadPoolExecutor(max_workers=8) as pool: jobs = list(pool.map(self.store.start_twin, bodies))
        self.assertEqual(len({r['job']['id'] for r in jobs}), 1)
        self.service.run_one(); self.assertEqual(self.model.calls, 2)
        self.assertFalse(self.service.run_one())

    def test_lost_response_receipt_remains_idempotent_after_completion(self):
        body = self.request(); first = self.store.start_twin(body)['job']; self.service.run_one()
        for _ in range(5): self.assertEqual(self.store.start_twin(body)['job']['id'], first['id'])
        self.assertEqual(self.create()['id'], first['id']); self.assertEqual(self.model.calls, 2)

    def test_late_retry_from_failed_attempt_cannot_create_third_task(self):
        first = self.create(); claim = self.store.claim_twin('worker')
        self.store.update_twin(first['id'], claim['claim'], status='failed', error='test')
        second = self.create(expectedJobId=first['id'])
        claim = self.store.claim_twin('worker'); self.store.update_twin(second['id'], claim['claim'], status='failed', error='test')
        self.assertEqual(self.create(expectedJobId=first['id'])['id'], second['id'])

    def test_publication_keeps_ledger_and_photos_unchanged(self):
        original = copy.deepcopy(self.record()); raw = (self.store.photos_dir / self.rid / '0.png').read_bytes()
        job = self.publish(); self.assertEqual(job['status'], 'succeeded'); self.assertEqual(self.record(), original)
        self.assertIsNone(self.record()['cost']); self.assertEqual((self.store.photos_dir / self.rid / '0.png').read_bytes(), raw)
        self.assertEqual(self.store.published_twin_asset(job['id'], 'photo-0.png').read_bytes(), raw)
        self.assertNotIn(TWIN_KEY, self.store.state()['settings'])

    def test_note_and_cost_edits_do_not_invalidate_entity(self):
        job = self.publish(); r = self.record()
        self.store.save({'id': self.rid, 'revision': r['revision'], 'note': 'new note', 'price': '10'})
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'succeeded')
        self.assertEqual(self.create()['id'], job['id'])

    def test_changed_input_revokes_old_worker_and_fences_publication(self):
        first = self.create(); claimed = self.store.claim_twin('old')
        r = self.record(); self.store.save({'id': self.rid, 'revision': r['revision'], 'version': 'changed'})
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'stale')
        second = self.create(expectedJobId=first['id'])
        self.assertNotEqual(second['id'], first['id'])
        self.assertFalse(self.store.update_twin(first['id'], claimed['claim'], status='succeeded', entity={}))
        self.assertEqual(self.store.claim_twin('new')['id'], second['id'])

    def test_reordering_or_replacing_photos_invalidates_ready_entity(self):
        self.publish(); r = self.record()
        self.store.save({'id': self.rid, 'revision': r['revision'], 'photos': [PHOTO]})
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'stale')

    def test_restarted_instance_does_not_steal_live_lease_or_replay_paid_work(self):
        job = self.create(); old = self.store.claim_twin('old', stamp=1000)
        another = Store(self.store.path)
        self.assertIsNone(another.claim_twin('new', stamp=1010))
        self.assertTrue(self.store.heartbeat_twin(job['id'], old['claim'], stamp=1030))
        self.assertIsNone(another.claim_twin('new', stamp=1100))
        self.assertIsNone(another.claim_twin('new', stamp=1121))
        self.assertEqual(another.twin_index()['jobs'][self.rid]['status'], 'interrupted')
        self.assertFalse(self.store.update_twin(job['id'], old['claim'], status='failed', error='late'))
        self.assertEqual(self.model.calls, 0)

    def test_cancelled_result_and_working_files_cannot_be_published(self):
        job = self.create(); claim = self.store.claim_twin('worker'); self.store.cancel_twin(job['id'])
        self.assertFalse(self.store.update_twin(job['id'], claim['claim'], status='succeeded', entity={}))
        with self.assertRaises(ValidationError): self.store.published_twin_asset(job['id'], 'photo-0.png')

    def test_backup_restore_interrupts_tasks_without_replaying_them(self):
        first = self.create(); self.store.claim_twin('worker')
        backup = copy.deepcopy(self.store.backup()); self.store.restore_backup(backup)
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'interrupted')
        self.assertFalse(self.service.run_one()); self.assertEqual(self.model.calls, 0)

    def test_ready_backup_restored_without_asset_files_returns_2d_state(self):
        self.publish(); backup = copy.deepcopy(self.store.backup())
        with tempfile.TemporaryDirectory() as other:
            restored = Store(Path(other) / 'albums.sqlite3'); restored.restore_backup(backup)
            self.assertEqual(restored.twin_index()['jobs'][self.rid]['status'], 'interrupted')

    def test_wrong_edition_is_not_sent_to_generation_model(self):
        self.service.mb = type('Wrong', (), {'get': lambda *_: {'title': 'Other Album', 'artist-credit': [{'name': 'Other Artist'}], 'media': [{'format': 'CD'}]}})()
        self.create(); self.service.run_one()
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'needs_input'); self.assertEqual(self.model.calls, 0)

    def test_unknown_or_missing_surfaces_and_bad_regions_do_not_become_ready(self):
        source = {'photo:0': {'asset': 'photo-0.png'}}
        for spec in [ {'sameAlbum': True, 'packaging': {'structure': 'gatefold'}, 'surfaces': {}},
                      {'sameAlbum': True, 'packaging': {'structure': 'unknown'}, 'surfaces': {}},
                      {'sameAlbum': True, 'packaging': {'structure': 'gatefold'}, 'surfaces': {'front': {'sourceId': 'other'}}}]:
            with self.assertRaises(ValidationError): clean_entity(spec, source)


class TwinHttpTests(unittest.TestCase):
    record = DigitalTwinTests.record
    request = DigitalTwinTests.request
    def setUp(self):
        DigitalTwinTests.setUp(self); self.auth = Auth(Path(self.tmp.name) / 'auth.sqlite3'); self.auth.set_password('fixture-password-12345')
        self.http = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(Services(store=self.store, auth=self.auth, twins=self.service)))
        threading.Thread(target=self.http.serve_forever, daemon=True).start()

    def tearDown(self): self.http.shutdown(); self.http.server_close(); DigitalTwinTests.tearDown(self)
    def http_req(self, path, body=None, cookie=None, origin=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.http.server_port)
        headers = {'Content-Type': 'application/json'}
        if cookie: headers['Cookie'] = cookie
        if origin: headers['Origin'] = origin
        connection.request('GET' if body is None else 'POST', path, json.dumps(body) if body is not None else None, headers)
        response = connection.getresponse(); result = response.status, dict(response.headers), response.read(); connection.close(); return result

    def test_http_auth_origin_and_published_assets(self):
        for route in ['/api/twins', '/api/twin-assets/' + uid() + '/photo-0.png']:
            self.assertEqual(self.http_req(route)[0], 401)
        _, headers, _ = self.http_req('/api/login', {'password': 'fixture-password-12345'}); cookie = headers['Set-Cookie']
        body = self.request()
        self.assertEqual(self.http_req('/api/twins/start', body, cookie, 'https://evil.example')[0], 403)
        status, _, raw = self.http_req('/api/twins/start', body, cookie); self.assertEqual(status, 200)
        task = json.loads(raw)['job']; self.assertEqual(self.http_req('/api/twin-assets/' + task['id'] + '/photo-0.png', cookie=cookie)[0], 400)
        self.service.run_one()
        status, _, raw = self.http_req('/api/twins', cookie=cookie)
        self.assertEqual(status, 200); self.assertEqual(json.loads(raw)['jobs'][self.rid]['status'], 'succeeded')
        status, _, raw = self.http_req('/api/twin-assets/' + task['id'] + '/photo-0.png', cookie=cookie)
        self.assertEqual(status, 200); self.assertEqual(raw, PNG)
        self.assertEqual(self.http_req('/api/twin-assets/' + task['id'] + '/cover.tmp', cookie=cookie)[0], 400)

    def test_http_disabled_showcase_cannot_start_generation(self):
        _, headers, _ = self.http_req('/api/login', {'password': 'fixture-password-12345'}); cookie = headers['Set-Cookie']
        self.store.set_modules({'showcase': False, 'acquisition': False, 'trading': False, 'circulation': False})
        self.assertEqual(self.http_req('/api/twins/start', self.request(), cookie)[0], 400)


if __name__ == '__main__': unittest.main()
