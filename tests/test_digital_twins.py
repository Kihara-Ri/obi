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

from domain import ValidationError, ConflictError
from storage import Store, uid
from server.digital_twins import DigitalTwinService, ArtNotFound
from server import Services, make_handler
from security import Auth
from twins import TWIN_KEY, clean_barcode, clean_entity

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')
PHOTO = 'data:image/png;base64,' + base64.b64encode(PNG).decode()
EDITION = '11111111-1111-4111-8111-111111111111'
BARCODE = '4988013047105'
FULL = {'structure': 'gatefold', 'panels': 2, 'holder': 'pocket', 'pockets': 'both', 'pocketOpening': 'inner', 'discs': 2,
        'photos': {role: 0 for role in ('front', 'back', 'insideLeft', 'insideRight', 'disc', 'disc2')}}


class Model:
    def __init__(self): self.calls = 0; self.configured = True; self.ocr = []; self.ocr_calls = 0
    def public_config(self): return {'configured': self.configured}
    def catalog(self, _fields): return []
    def agent_json(self, _skill, instruction, images=(), on_start=None):
        if on_start: on_start()
        if instruction.startswith('BARCODE'):
            self.ocr_calls += 1
            return {'barcodes': self.ocr}
        self.calls += 1
        if instruction.startswith('PLAN'): return {'sourceIds': ['photo:0']}
        return {'sameAlbum': True, 'packaging': {'structure': 'gatefold', 'discs': 2}, 'surfaces': {}, 'warnings': []}


class Metadata:
    def __init__(self): self.calls = []
    def get(self, _path, _params):
        self.calls.append((_path, _params))
        if _path == 'release': return {'count': 1, 'releases': [{'id': EDITION, 'barcode': BARCODE}]}
        assert 'recordings' in _params['inc'], 'release lookup must request medium/recording details'
        return {'id': EDITION, 'barcode': BARCODE, 'title': 'Test Album', 'artist-credit': [{'name': 'Test Artist'}],
                'date': '2000-03-01', 'country': 'JP', 'packaging': None,
                'label-info': [{'catalog-number': 'FIXTURE-001', 'label': {'name': 'Fixture Label'}}],
                'media': [{'position': 1, 'format': 'CD', 'tracks': [{'position': 1, 'title': 'Fixture Track', 'length': 123000}]},
                          {'position': 2, 'format': 'CD', 'tracks': []}]}


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
    def request(self, **patch): return {'recordId': self.rid, 'recordRevision': self.record()['revision'], 'requestId': uid(), 'barcode': BARCODE, **patch}
    def create(self, **patch): return self.store.start_twin(self.request(**patch))['job']
    def publish(self):
        job = self.create(); self.service.run_one(); self.service.confirm({'id': job['id'], 'releaseId': EDITION})
        self.service.run_one(); return self.store.twin_index()['jobs'][self.rid]

    def test_concurrent_tabs_and_different_keys_create_one_task(self):
        bodies = [self.request() for _ in range(16)]
        with ThreadPoolExecutor(max_workers=8) as pool: jobs = list(pool.map(self.store.start_twin, bodies))
        self.assertEqual(len({r['job']['id'] for r in jobs}), 1)
        self.service.run_one(); self.assertEqual(self.model.calls, 0)
        with ThreadPoolExecutor(max_workers=8) as pool:
            confirmed = list(pool.map(self.service.confirm, [{'id': jobs[0]['job']['id'], 'releaseId': EDITION}] * 16))
        self.assertEqual(len({r['job']['id'] for r in confirmed}), 1)
        self.service.run_one(); self.assertEqual(self.model.calls, 2)
        self.assertFalse(self.service.run_one())

    def test_lost_response_receipt_remains_idempotent_after_completion(self):
        body = self.request(); first = self.store.start_twin(body)['job']; self.service.run_one()
        confirm = {'id': first['id'], 'releaseId': EDITION}; self.service.confirm(confirm); self.service.run_one()
        for _ in range(5): self.assertEqual(self.store.start_twin(body)['job']['id'], first['id'])
        self.model.configured = False
        for _ in range(5): self.assertEqual(self.service.confirm(confirm)['job']['id'], first['id'])
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

    def test_explicit_new_barcode_after_success_starts_review_and_fences_old_confirmation(self):
        first = self.publish()
        second = self.create(barcode='4006381333931', expectedJobId=first['id'])
        self.assertNotEqual(second['id'], first['id']); self.assertEqual(second['phase'], 'locating_release')
        self.assertEqual(self.create(barcode='4006381333931', expectedJobId=first['id'])['id'], second['id'])
        with self.assertRaises(ConflictError): self.service.confirm({'id': first['id'], 'releaseId': EDITION})

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

    def test_even_unique_exact_barcode_requires_explicit_review_before_generation(self):
        self.create(); self.service.run_one()
        job = self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(job['status'], 'needs_input'); self.assertEqual(job['phase'], 'awaiting_confirmation'); self.assertEqual(self.model.calls, 0)
        self.assertFalse(self.service.run_one()); self.assertEqual(job['candidates'][0]['catalogNumber'], 'FIXTURE-001')
        self.assertEqual(job['candidates'][0]['media'][0]['tracks'][0]['title'], 'Fixture Track')
        self.assertEqual(self.service.mb.calls[0][1]['query'], 'barcode:"' + BARCODE + '"')

    def test_preview_limit_distinguishes_skipped_previews_from_attempted_failure(self):
        class Previews:
            def __init__(_self): _self.attempts = []
            def catalog(_self, _edition):
                return {'images': [{'id': ident, 'types': ['Booklet']} for ident in range(100, 120)]}
            def image(_self, _edition, ident, preview=False):
                _self.attempts.append(ident)
                if ident == '101': raise ValidationError('thumbnail temporarily unavailable')
                return PNG
        art = Previews(); self.service.art = art; self.create(); self.service.run_one()
        artwork = self.store.twin_index()['jobs'][self.rid]['candidates'][0]['artwork']
        self.assertEqual(len(artwork), 20); self.assertEqual(art.attempts, [str(i) for i in range(100, 116)])
        self.assertEqual(artwork[0]['previewStatus'], 'available'); self.assertIn('previewUrl', artwork[0])
        self.assertEqual(artwork[1]['previewStatus'], 'unavailable'); self.assertNotIn('previewUrl', artwork[1])
        for image in artwork[16:]:
            self.assertEqual(image['previewStatus'], 'not_loaded'); self.assertNotIn('previewUrl', image)
        self.assertEqual(self.model.calls, 0)

    def test_manual_barcode_lookup_works_without_visual_model_but_confirmation_keeps_review(self):
        self.model.configured = False; first = self.create(); self.service.run_one()
        job = self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(job['phase'], 'awaiting_confirmation'); self.assertEqual(job['barcodeSource'], 'manual')
        with self.assertRaises(ValidationError): self.service.confirm({'id': first['id'], 'releaseId': EDITION})
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['phase'], 'awaiting_confirmation')
        self.assertEqual(self.model.calls, 0); self.assertEqual(self.model.ocr_calls, 0)

    def test_readable_physical_back_barcode_is_evidence_but_still_requires_confirmation(self):
        self.model.ocr = [{'barcode': BARCODE, 'sourceId': 'photo:0', 'readable': True, 'sameCopy': True, 'surface': 'back'}]
        self.create(barcode=''); self.service.run_one(); job = self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(job['barcode'], BARCODE); self.assertEqual(job['barcodeSource'], 'photo')
        self.assertEqual(job['phase'], 'awaiting_confirmation'); self.assertEqual(self.model.calls, 0); self.assertEqual(self.model.ocr_calls, 1)

    def test_unclear_partial_foreign_photo_or_booklet_advert_never_drives_lookup(self):
        readings = [[], [{'barcode': BARCODE, 'sourceId': 'photo:0', 'readable': False, 'sameCopy': True, 'surface': 'back'}],
                    [{'barcode': BARCODE[:-1], 'sourceId': 'photo:0', 'readable': True, 'sameCopy': True, 'surface': 'back'}],
                    [{'barcode': BARCODE, 'sourceId': 'photo:99', 'readable': True, 'sameCopy': True, 'surface': 'back'}],
                    [{'barcode': BARCODE, 'sourceId': 'photo:0', 'readable': True, 'sameCopy': False, 'surface': 'back'}],
                    [{'barcode': BARCODE, 'sourceId': 'photo:0', 'readable': True, 'sameCopy': True, 'surface': 'booklet'}]]
        latest = None
        for reading in readings:
            self.model.ocr = reading; latest = self.create(barcode='', expectedJobId=latest and latest['id'])
            self.service.run_one(); self.assertEqual(self.store.twin_index()['jobs'][self.rid]['phase'], 'awaiting_barcode')
        self.assertEqual(self.service.mb.calls, []); self.assertEqual(self.model.calls, 0)

    def test_missing_model_or_saved_barcode_does_not_guess_from_ledger_or_title(self):
        r = self.record(); self.store.save({'id': self.rid, 'revision': r['revision'], 'releaseInfo': {'barcode': BARCODE}})
        self.model.configured = False; self.create(barcode=''); self.service.run_one()
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['phase'], 'awaiting_barcode')
        self.assertEqual(self.service.mb.calls, [])

    def test_valid_checksum_does_not_resolve_multiple_physical_barcodes(self):
        self.model.ocr = [{'barcode': barcode, 'sourceId': 'photo:0', 'readable': True, 'sameCopy': True, 'surface': 'back'}
                          for barcode in (BARCODE, '4006381333931')]
        self.create(barcode=''); self.service.run_one()
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['phase'], 'awaiting_barcode'); self.assertEqual(self.service.mb.calls, [])

    def test_search_near_match_wrong_media_and_incomplete_barcode_are_rejected(self):
        metadata = Metadata()
        for wrong in ('4006381333931', BARCODE):
            class Wrong:
                def get(_self, path, params):
                    if path == 'release': return {'releases': [{'id': EDITION, 'barcode': wrong}], 'count': 1}
                    result = metadata.get(path, params); result['media'] = [{'format': '12" Vinyl'}]; return result
            self.service.mb = Wrong(); latest = self.store.twin_index()['jobs'].get(self.rid)
            self.create(expectedJobId=latest and latest['id']); self.service.run_one()
            self.assertEqual(self.store.twin_index()['jobs'][self.rid]['phase'], 'awaiting_barcode'); self.assertEqual(self.model.calls, 0)
        with self.assertRaises(ValidationError): self.create(barcode=BARCODE[:-1] + '4')
        self.assertEqual(clean_barcode('４９８８０１３０４７１０５'), BARCODE)

    def test_confirmation_is_fenced_by_candidate_membership_and_photo_changes(self):
        first = self.create(); self.service.run_one()
        with self.assertRaises(ValidationError): self.service.confirm({'id': first['id'], 'releaseId': '22222222-2222-4222-8222-222222222222'})
        r = self.record(); self.store.save({'id': self.rid, 'revision': r['revision'], 'photos': [PHOTO]})
        with self.assertRaises(ConflictError): self.service.confirm({'id': first['id'], 'releaseId': EDITION})
        second = self.create(expectedJobId=first['id']); self.service.run_one()
        with self.assertRaises(ConflictError): self.service.confirm({'id': first['id'], 'releaseId': EDITION})
        self.assertNotEqual(first['id'], second['id']); self.assertEqual(self.model.calls, 0)

    def test_generation_uses_confirmed_release_and_catalog_snapshot(self):
        first = self.create(); self.service.run_one(); self.service.confirm({'id': first['id'], 'releaseId': EDITION})
        self.service.mb = type('MustNotSearch', (), {'get': lambda *_: self.fail('generation must use reviewed metadata')})()
        self.service.art = type('MustNotRefresh', (), {'catalog': lambda *_: self.fail('generation must use reviewed artwork list')})()
        self.service.run_one(); self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'succeeded')

    def test_unavailable_artwork_is_rechecked_for_same_confirmed_edition_before_plan(self):
        class Recovering:
            def __init__(_self): _self.editions = []
            def catalog(_self, edition):
                _self.editions.append(edition)
                if len(_self.editions) == 1: raise ValidationError('temporarily unavailable')
                return {'images': [{'id': 123, 'types': ['Front']}]}
        art = Recovering(); self.service.art = art
        first = self.create(); self.service.run_one()
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['candidates'][0]['artworkStatus'], 'unavailable')
        self.service.confirm({'id': first['id'], 'releaseId': EDITION})
        original = self.model.agent_json
        def inspect(_skill, instruction, *args, **kwargs):
            if instruction.startswith('PLAN'):
                context = json.loads(instruction.split('\n', 1)[1]); self.assertEqual(context['archiveImages'][0]['id'], '123')
            return original(_skill, instruction, *args, **kwargs)
        self.model.agent_json = inspect; self.service.run_one()
        self.assertEqual(art.editions, [EDITION, EDITION]); self.assertEqual(self.model.calls, 2)
        self.assertEqual(len(self.service.mb.calls), 2); self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'succeeded')

    def test_still_unavailable_artwork_stops_before_paid_model_without_complete_own_faces(self):
        class Unavailable:
            def __init__(_self): _self.calls = 0
            def catalog(_self, _edition): _self.calls += 1; raise ValidationError('temporarily unavailable')
        art = Unavailable(); self.service.art = art
        r = self.record(); self.store.save({'id': self.rid, 'revision': r['revision'], 'packaging': None})
        first = self.create(); self.service.run_one(); self.service.confirm({'id': first['id'], 'releaseId': EDITION}); self.service.run_one()
        job = self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(art.calls, 2); self.assertEqual(self.model.calls, 0)
        self.assertEqual(job['status'], 'needs_input'); self.assertEqual(job['phase'], 'source_unavailable'); self.assertIn('尚未调用生成模型', job['error'])

    def test_complete_user_bound_photos_allow_generation_during_artwork_outage(self):
        class Unavailable:
            def catalog(_self, _edition): raise ValidationError('temporarily unavailable')
        self.service.art = Unavailable(); first = self.create(); self.service.run_one()
        self.service.confirm({'id': first['id'], 'releaseId': EDITION}); self.service.run_one()
        self.assertEqual(self.model.calls, 2); self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'succeeded')

    def test_own_photo_coverage_uses_confirmed_disc_count_when_manual_count_is_missing(self):
        class Unavailable:
            def catalog(_self, _edition): raise ValidationError('temporarily unavailable')
        manual = copy.deepcopy(FULL); manual.pop('discs'); manual['photos'].pop('disc2')
        r = self.record(); self.store.save({'id': self.rid, 'revision': r['revision'], 'packaging': manual})
        self.service.art = Unavailable(); first = self.create(); self.service.run_one()
        self.service.confirm({'id': first['id'], 'releaseId': EDITION}); self.service.run_one()
        self.assertEqual(self.model.calls, 0); self.assertEqual(self.store.twin_index()['jobs'][self.rid]['phase'], 'source_unavailable')

    def test_confirmed_missing_artwork_does_not_become_transient_outage(self):
        class Missing:
            def __init__(_self): _self.calls = 0
            def catalog(_self, _edition): _self.calls += 1; raise ArtNotFound('404')
        art = Missing(); self.service.art = art; first = self.create(); self.service.run_one()
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['candidates'][0]['artworkStatus'], 'missing')
        self.service.confirm({'id': first['id'], 'releaseId': EDITION}); self.service.run_one()
        self.assertEqual(art.calls, 1); self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'succeeded')

    def test_barcode_model_error_and_missing_snapshot_offer_manual_fallback(self):
        original = self.model.agent_json
        def broken(*_args, **_kwargs): raise ValidationError('provider unavailable')
        self.model.agent_json = broken; first = self.create(barcode=''); self.service.run_one()
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['phase'], 'awaiting_barcode')
        self.model.agent_json = original; second = self.create(barcode='', expectedJobId=first['id'])
        self.store.twin_source(second['id'], 'photo-0.png').unlink(); self.service.run_one()
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['phase'], 'awaiting_barcode')
        self.assertEqual(self.service.mb.calls, [])

    def test_missing_actual_back_or_inner_surfaces_stays_unpublished_after_confirmation(self):
        r = self.record(); self.store.save({'id': self.rid, 'revision': r['revision'], 'packaging': None})
        first = self.create(); self.service.run_one(); self.service.confirm({'id': first['id'], 'releaseId': EDITION})
        self.service.run_one(); job = self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(job['status'], 'needs_input'); self.assertEqual(job['phase'], 'needs_material'); self.assertIn('贴图', job['error'])
        with self.assertRaises(ValidationError): self.store.published_twin_asset(first['id'], 'photo-0.png')

    def test_multiple_cd_editions_require_choice_and_conflicting_confirmation_is_fenced(self):
        second_edition = '22222222-2222-4222-8222-222222222222'; base = Metadata()
        class Many:
            def get(_self, path, params):
                if path == 'release': return {'count': 2, 'releases': [{'id': edition, 'barcode': BARCODE} for edition in (EDITION, second_edition)]}
                result = base.get(path, params); result['id'] = path.split('/')[-1]; return result
        self.service.mb = Many(); first = self.create(); self.service.run_one()
        job = self.store.twin_index()['jobs'][self.rid]; self.assertEqual(len(job['candidates']), 2); self.assertEqual(self.model.calls, 0)
        self.service.confirm({'id': first['id'], 'releaseId': second_edition})
        with self.assertRaises(ConflictError): self.service.confirm({'id': first['id'], 'releaseId': EDITION})
        self.service.run_one(); self.assertEqual(self.store.twin_index()['jobs'][self.rid]['entity']['release']['id'], second_edition)

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
        self.assertEqual(self.http_req('/api/twins/confirm', {'id': task['id'], 'releaseId': EDITION}, cookie, 'https://evil.example')[0], 403)
        self.assertEqual(self.http_req('/api/twins/confirm', {'id': task['id'], 'releaseId': EDITION}, cookie)[0], 200)
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

    def test_review_artwork_is_protected_and_not_published_entity_artwork(self):
        class Preview:
            def catalog(_self, _edition): return {'images': [{'id': 123, 'types': ['Front'], 'comment': ''}]}
            def image(_self, *_args, **_kwargs): return PNG
        self.service.art = Preview()
        _, headers, _ = self.http_req('/api/login', {'password': 'fixture-password-12345'}); cookie = headers['Set-Cookie']
        _, _, raw = self.http_req('/api/twins/start', self.request(), cookie); task = json.loads(raw)['job']; self.service.run_one()
        candidate = self.store.twin_index()['jobs'][self.rid]['candidates'][0]; image = candidate['artwork'][0]
        self.assertEqual(self.http_req(image['previewUrl'])[0], 401)
        status, headers, raw = self.http_req(image['previewUrl'], cookie=cookie)
        self.assertEqual(status, 200); self.assertEqual(raw, PNG); self.assertTrue(headers['Cache-Control'].startswith('private'))
        self.assertEqual(self.http_req('/api/twin-review-assets/' + task['id'] + '/photo-0.png', cookie=cookie)[0], 400)
        self.assertEqual(self.http_req('/api/twin-assets/' + task['id'] + '/' + image['previewAsset'], cookie=cookie)[0], 400)


if __name__ == '__main__': unittest.main()
