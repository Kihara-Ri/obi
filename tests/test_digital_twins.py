import base64
import copy
import tempfile
import threading
import json
import http.client
from http.server import ThreadingHTTPServer
import unittest
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from domain import ValidationError, ConflictError
from storage import Store, uid
from server.digital_twins import DigitalTwinService, ArtNotFound, DiscogsClient, DiscogsRedirect
from server import Services, make_handler
from security import Auth
from twins import TWIN_KEY, clean_barcode, clean_entity, clean_registry

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

    def test_saved_release_is_reused_without_second_selection(self):
        """Barcode -> release UUID persisted on copy -> artwork and twin use same UUID."""
        record = self.record()
        self.store.save({'id': self.rid, 'revision': record['revision'],
                         'releaseInfo': {'barcode': BARCODE, 'musicBrainzReleaseId': EDITION}})
        with_store = Store(self.store.path)
        persisted = next(r for r in with_store.state()['records'] if r['id'] == self.rid)
        self.assertEqual(persisted['releaseInfo']['musicBrainzReleaseId'], EDITION)
        request = self.request(barcode='')
        job = self.store.start_twin(request)['job']
        self.assertEqual(job['barcodeSource'], 'record')
        self.service.run_one()
        intermediate = self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(intermediate['status'], 'queued')
        self.assertEqual(intermediate['releaseId'], EDITION)
        self.assertEqual([path for path, _ in self.service.mb.calls], ['release/' + EDITION])
        self.assertEqual(self.model.calls, 0)
        self.service.run_one()
        finished = self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(finished['status'], 'succeeded')
        self.assertEqual(finished['releaseId'], EDITION)
        self.assertEqual(self.model.calls, 2)
        self.assertEqual(self.store.start_twin(request)['job']['id'], job['id'])

    def test_saved_release_rejects_conflicting_barcode_and_invalid_id(self):
        record = self.record()
        with self.assertRaises(ValidationError):
            self.store.save({'id': self.rid, 'revision': record['revision'],
                             'releaseInfo': {'barcode': BARCODE, 'musicBrainzReleaseId': 'unverified'}})
        self.store.save({'id': self.rid, 'revision': record['revision'],
                         'releaseInfo': {'barcode': BARCODE, 'musicBrainzReleaseId': EDITION}})
        with self.assertRaises(ValidationError):
            self.store.start_twin(self.request(barcode='4006381333931'))

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

    def test_pre_release_uuid_published_entity_survives_upgrade(self):
        """An old successful task remains visible when only the snapshot schema changes."""
        job = self.publish()
        with self.store.connect() as db:
            registry = self.store.meta_get(db, TWIN_KEY)
            registry['jobs'][job['id']]['input']['releaseInfo'].pop('musicBrainzReleaseId')
            db.execute('UPDATE meta SET data=? WHERE key=?', (json.dumps(registry), TWIN_KEY))
            db.commit()

        before = self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(before['status'], 'succeeded')
        self.assertIsNotNone(before['entity'])
        self.assertEqual(self.store.start_twin(self.request())['job']['id'], job['id'])

        # Changing an unrelated field still invalidates the older snapshot.
        record = self.record()
        self.store.save({'id': self.rid, 'revision': record['revision'], 'version': 'new edition'})
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'stale')

    def test_pre_release_uuid_snapshot_rejects_new_confirmed_edition(self):
        job = self.publish()
        with self.store.connect() as db:
            registry = self.store.meta_get(db, TWIN_KEY)
            registry['jobs'][job['id']]['input']['releaseInfo'].pop('musicBrainzReleaseId')
            db.execute('UPDATE meta SET data=? WHERE key=?', (json.dumps(registry), TWIN_KEY))
            db.commit()
        record = self.record()
        self.store.save({'id': self.rid, 'revision': record['revision'],
                         'releaseInfo': {'barcode': BARCODE, 'musicBrainzReleaseId': EDITION}})
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'stale')

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
                self.assertEqual(context['archiveStatus'], 'available')
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

    def test_spine_and_surface_calibration_survives_restore_without_ledger_changes(self):
        original = copy.deepcopy(self.record())
        original_agent = self.model.agent_json
        rows = [[.2, .1, .3, .1], [.21, .5, .31, .5], [.2, .9, .3, .9]]
        def calibrated(skill, instruction, *args, **kwargs):
            result = original_agent(skill, instruction, *args, **kwargs)
            if instruction.startswith('BUILD'):
                result['surfaces']['spine'] = {'sourceId': 'photo:0', 'warpRows': rows}
                result['calibration'] = {'spine': {'widthRatio': .035, 'sourceId': 'photo:0',
                                                 'basis': 'image-estimate', 'reliefMm': [-.1, 0, .1]}}
            return result
        self.model.agent_json = calibrated
        job = self.publish()
        self.assertEqual(job['entity']['surfaces']['spine']['warpRows'], rows)
        self.assertEqual(job['entity']['calibration'], {'spine': {'widthRatio': .035, 'asset': 'photo-0.png',
            'sourceUrl': '', 'origin': 'record-photo', 'basis': 'image-estimate', 'reliefMm': [-.1, 0, .1]}})
        backup = copy.deepcopy(self.store.backup()); self.store.restore_backup(backup)
        restored = self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(restored['entity'], job['entity'])
        self.assertEqual(self.record(), original)

    def test_mandated_front_and_back_photos_keep_same_source_warp_rows(self):
        original_agent = self.model.agent_json; original_record = copy.deepcopy(self.record())
        rows = {'front': [[.51, 0, 1, 0], [.5, .5, .99, .5], [.51, 1, 1, 1]],
                'back': [[0, 0, .49, 0], [.01, .5, .5, .5], [0, 1, .49, 1]]}
        def calibrated(skill, instruction, *args, **kwargs):
            result = original_agent(skill, instruction, *args, **kwargs)
            if instruction.startswith('BUILD'):
                result['surfaces'].update({role: {'sourceId': 'photo:0', 'warpRows': warp} for role, warp in rows.items()})
            return result
        self.model.agent_json = calibrated; job = self.publish()
        self.assertEqual(job['status'], 'succeeded')
        for role, expected in rows.items():
            self.assertEqual(job['entity']['surfaces'][role].get('warpRows'), expected)
            self.assertEqual(job['entity']['surfaces'][role]['asset'], 'photo-0.png')
        self.assertEqual(self.record(), original_record)

    def test_mandated_photo_discards_other_source_warp_and_keeps_manual_region(self):
        manual = copy.deepcopy(FULL); region = [0, 0, .49, 0, .49, 1, 0, 1]
        manual['photoRegions'] = {'front': region}
        r = self.record(); self.store.save({'id': self.rid, 'revision': r['revision'], 'photos': [PHOTO, PHOTO], 'packaging': manual})
        original_agent = self.model.agent_json
        def other_photo(skill, instruction, *args, **kwargs):
            result = original_agent(skill, instruction, *args, **kwargs)
            if instruction.startswith('PLAN'): result['sourceIds'] = ['photo:0', 'photo:1']
            if instruction.startswith('BUILD'):
                result['surfaces']['front'] = {'sourceId': 'photo:1', 'region': [.51, 0, 1, 0, 1, 1, .51, 1],
                    'warpRows': [[.51, 0, 1, 0], [.51, 1, 1, 1]]}
            return result
        self.model.agent_json = other_photo; job = self.publish()
        self.assertEqual(job['status'], 'succeeded')
        self.assertEqual(job['entity']['surfaces']['front']['asset'], 'photo-0.png')
        self.assertEqual(job['entity']['surfaces']['front']['region'], region)
        self.assertNotIn('warpRows', job['entity']['surfaces']['front'])

    def test_mandated_same_photo_invalid_warp_cannot_silently_publish(self):
        manual = copy.deepcopy(FULL); manual['photoRegions'] = {'front': [0, 0, 1, 0, 1, 1, 0, 1]}
        r = self.record(); self.store.save({'id': self.rid, 'revision': r['revision'], 'packaging': manual})
        original_agent = self.model.agent_json
        def invalid_warp(skill, instruction, *args, **kwargs):
            result = original_agent(skill, instruction, *args, **kwargs)
            if instruction.startswith('BUILD'):
                result['surfaces']['front'] = {'sourceId': 'photo:0', 'warpRows': [0, 1]}
            return result
        self.model.agent_json = invalid_warp; job = self.publish()
        self.assertEqual(job['status'], 'needs_input'); self.assertIsNone(job['entity'])

    def test_manual_region_keeps_same_source_rows_matching_its_boundary(self):
        region = [.1, .1, .6, .1, .6, .9, .1, .9]
        manual = copy.deepcopy(FULL); manual['photoRegions'] = {'front': region}
        r = self.record(); self.store.save({'id': self.rid, 'revision': r['revision'], 'packaging': manual})
        rows = [[.1, .1, .6, .1], [.11, .5, .59, .5], [.1, .9, .6, .9]]
        original_agent = self.model.agent_json
        def calibrated(skill, instruction, *args, **kwargs):
            result = original_agent(skill, instruction, *args, **kwargs)
            if instruction.startswith('BUILD'):
                result['surfaces']['front'] = {'sourceId': 'photo:0', 'warpRows': rows}
            return result
        self.model.agent_json = calibrated; job = self.publish()
        self.assertEqual(job['status'], 'succeeded')
        self.assertEqual(job['entity']['surfaces']['front']['warpRows'], rows)
        self.assertEqual(job['entity']['surfaces']['front']['region'], region)

    def test_conflicting_manual_region_discards_same_source_rows_with_warning(self):
        region = [.1, .1, .6, .1, .6, .9, .1, .9]
        manual = copy.deepcopy(FULL); manual['photoRegions'] = {'front': region, 'back': region}
        r = self.record(); self.store.save({'id': self.rid, 'revision': r['revision'], 'packaging': manual})
        original_agent = self.model.agent_json
        def calibrated(skill, instruction, *args, **kwargs):
            result = original_agent(skill, instruction, *args, **kwargs)
            if instruction.startswith('BUILD'):
                result['surfaces']['front'] = {'sourceId': 'photo:0', 'warpRows': [[.2, .1, .6, .1], [.2, .9, .6, .9]]}
                result['surfaces']['back'] = {'sourceId': 'photo:0', 'warpRows': [[.1, .1, .6, .1], [.01, .5, .6, .5], [.1, .9, .6, .9]]}
            return result
        self.model.agent_json = calibrated; job = self.publish()
        self.assertEqual(job['status'], 'succeeded')
        for role in ('front', 'back'):
            self.assertEqual(job['entity']['surfaces'][role]['region'], region)
            self.assertNotIn('warpRows', job['entity']['surfaces'][role])
            self.assertTrue(any(role in warning and '未应用' in warning for warning in job['entity']['warnings']))

    def test_discogs_same_edition_metadata_and_images_are_frozen_with_confirmation(self):
        base = Metadata()
        class Linked:
            def get(_self, path, params):
                result = base.get(path, params)
                if path != 'release':
                    self.assertIn('url-rels', params['inc'])
                    result['relations'] = [{'type': 'discogs', 'url': {'resource': 'https://www.discogs.com/release/2485482-Islands'}}]
                return result
        class Reference:
            def __init__(_self): _self.reads = []
            def release(_self, ident):
                _self.reads.append(ident)
                return {'id': 2485482, 'title': 'Test Album', 'notes': 'Gatefold vinyl replica sleeve, with separate booklets and OBI.',
                        'identifiers': [{'type': 'Barcode', 'value': BARCODE}],
                        'labels': [{'catno': 'FIXTURE-001'}], 'formats': [{'name': 'CD', 'qty': '2'}],
                        'images': [{'type': 'primary', 'uri': 'https://i.discogs.com/frozen-front.jpeg', 'width': 600, 'height': 600}]}
            def image(_self, url):
                self.assertEqual(url, 'https://i.discogs.com/frozen-front.jpeg'); return PNG
        reference = Reference(); self.service.discogs = reference; self.service.mb = Linked()
        first = self.create(); self.service.run_one()
        review = self.store.twin_index()['jobs'][self.rid]['candidates'][0]
        self.assertEqual(review['editionReferences'][0]['status'], 'verified')
        self.assertIn('Gatefold', review['editionReferences'][0]['notes'])
        self.service.confirm({'id': first['id'], 'releaseId': EDITION})
        reference.release = lambda *_: self.fail('confirmed reference metadata must stay frozen')
        original_agent = self.model.agent_json
        def using_reference(skill, instruction, *args, **kwargs):
            if instruction.startswith('PLAN'):
                context = json.loads(instruction.split('\n', 1)[1]); ref = context['editionReferences'][0]
                self.assertEqual(ref['images'][0]['sourceId'], 'discogs:2485482:0')
                self.assertIn('Gatefold', ref['notes'])
                return {'sourceIds': ['photo:0', 'discogs:2485482:0']}
            result = original_agent(skill, instruction, *args, **kwargs)
            if instruction.startswith('BUILD'):
                self.assertIn('Gatefold', instruction)
                result['surfaces']['spine'] = {'sourceId': 'discogs:2485482:0'}
            return result
        self.model.agent_json = using_reference; self.service.run_one()
        job = self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(job['status'], 'succeeded')
        self.assertEqual(job['entity']['surfaces']['spine'], {'asset': 'discogs-2485482-0.png', 'region': None,
            'sourceUrl': 'https://i.discogs.com/frozen-front.jpeg', 'origin': 'edition-reference'})
        self.assertEqual(self.store.published_twin_asset(job['id'], 'discogs-2485482-0.png').read_bytes(), PNG)
        self.assertEqual(reference.reads, ['2485482'])

    def test_discogs_unavailable_mismatched_or_arbitrary_links_do_not_supply_images(self):
        base = Metadata()
        class Linked:
            def __init__(_self, url): _self.url = url
            def get(_self, path, params):
                result = base.get(path, params)
                if path != 'release': result['relations'] = [{'type': 'discogs', 'url': {'resource': _self.url}}]
                return result
        class Reference:
            def __init__(_self, barcode, catno): _self.barcode = barcode; _self.catno = catno
            def release(_self, ident):
                if _self.barcode is None: raise ValidationError('unavailable')
                return {'id': 2485482, 'notes': 'must not be accepted', 'identifiers': [{'type': 'Barcode', 'value': _self.barcode}],
                        'labels': [{'catno': _self.catno}], 'formats': [{'name': 'CD'}],
                        'images': [{'uri': 'https://i.discogs.com/wrong.jpeg'}]}
        latest = None
        for barcode, catno, status in [(None, 'FIXTURE-001', 'unavailable'), ('4006381333931', 'FIXTURE-001', 'mismatched'),
                                        (BARCODE, 'WRONG-001', 'mismatched')]:
            self.service.mb = Linked('https://www.discogs.com/release/2485482')
            self.service.discogs = Reference(barcode, catno)
            latest = self.create(expectedJobId=latest and latest['id']); self.service.run_one()
            ref = self.store.twin_index()['jobs'][self.rid]['candidates'][0]['editionReferences'][0]
            self.assertEqual(ref['status'], status); self.assertNotIn('images', ref); self.assertNotIn('notes', ref)
            self.store.cancel_twin(latest['id'])
        for link in ('https://www.discogs.com/master/2485482', 'https://arbitrary.example/release/2485482',
                     'https://www.discogs.com@arbitrary.example/release/2485482'):
            self.service.mb = Linked(link)
            self.service.discogs = type('MustNotFetch', (), {'release': lambda *_: self.fail('only exact release relationship may be followed')})()
            latest = self.create(expectedJobId=latest['id']); self.service.run_one()
            self.assertEqual(self.store.twin_index()['jobs'][self.rid]['candidates'][0]['editionReferences'], [])
            self.store.cancel_twin(latest['id'])

    def test_calibration_evidence_asset_is_published_and_missing_file_revokes_ready_state(self):
        original_agent = self.model.agent_json
        def calibrated(skill, instruction, *args, **kwargs):
            result = original_agent(skill, instruction, *args, **kwargs)
            if instruction.startswith('BUILD'):
                result['calibration'] = {'spine': {'widthRatio': .035, 'sourceId': 'photo:1', 'basis': 'image-estimate'}}
            elif instruction.startswith('PLAN'): result['sourceIds'] = ['photo:0', 'photo:1']
            return result
        r = self.record(); self.store.save({'id': self.rid, 'revision': r['revision'], 'photos': [PHOTO, PHOTO], 'packaging': FULL})
        self.model.agent_json = calibrated; job = self.publish()
        self.assertEqual(job['status'], 'succeeded')
        self.assertEqual(self.store.published_twin_asset(job['id'], 'photo-1.png').read_bytes(), PNG)
        backup = copy.deepcopy(self.store.backup()); self.store.restore_backup(backup)
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['entity']['calibration'], job['entity']['calibration'])
        self.store.twin_source(job['id'], 'photo-1.png').unlink()
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'interrupted')

    def test_missing_calibration_evidence_prevents_atomic_publication(self):
        job = self.create(); claim = self.store.claim_twin('worker')
        package = {k: v for k, v in FULL.items() if k != 'photos'}
        entity = clean_entity({'sameAlbum': True, 'packaging': package,
            'surfaces': {role: {'sourceId': 'photo:0'} for role in FULL['photos']},
            'calibration': {'spine': {'widthRatio': .035, 'sourceId': 'photo:1', 'basis': 'image-estimate'}}},
            {'photo:0': {'asset': 'photo-0.png'}, 'photo:1': {'asset': 'photo-1.png'}})
        with self.assertRaises(ValidationError): self.store.update_twin(job['id'], claim['claim'], status='succeeded', entity=entity)
        self.assertNotEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'succeeded')


class EntityCalibrationTests(unittest.TestCase):
    def setUp(self):
        self.sources = {'caa:12': {'asset': 'caa-12.png', 'origin': 'edition-reference',
                                  'sourceUrl': 'https://coverartarchive.org/release/' + EDITION + '/12.jpg'}}
        self.entity = {'sameAlbum': True, 'packaging': {'structure': 'gatefold', 'discs': 1},
                       'surfaces': {role: {'sourceId': 'caa:12'} for role in ('front', 'back', 'insideLeft', 'insideRight', 'disc')}}

    def test_original_coordinates_preserve_bent_spine_rows(self):
        rows = [[.1, .05, .2, .06], [.11, .5, .21, .51], [.1, .95, .2, .96]]
        self.entity['surfaces']['spine'] = {'sourceId': 'caa:12', 'warpRows': rows}
        cleaned = clean_entity(self.entity, self.sources)
        self.assertEqual(cleaned['surfaces']['spine']['warpRows'], rows)
        self.assertIsNone(cleaned['surfaces']['spine']['region'])

    def test_invalid_row_bounds_order_or_crossed_strip_cannot_be_published(self):
        invalid = [[], [[.1, .1, .2, .1]], [[.1, .1, .2, .1]] * 18,
                   [[-.1, .1, .2, .1], [.1, .9, .2, .9]],
                   [[.1, .1, .2, .1], [.1, float('nan'), .2, .9]],
                   [[.1, .1, True, .1], [.1, .9, .2, .9]],
                   [[.1, .9, .2, .9], [.1, .1, .2, .1]],
                   [[.1, .1, .2, .1], [.3, .9, .2, .9]],
                   [[.1, .1, .9, .8], [.2, .2, .8, .9]]]
        for rows in invalid:
            with self.subTest(rows=rows), self.assertRaises(ValidationError):
                self.entity['surfaces']['spine'] = {'sourceId': 'caa:12', 'warpRows': rows}
                clean_entity(self.entity, self.sources)

    def test_spine_estimate_resolves_frozen_source_and_does_not_claim_measurement(self):
        self.entity['calibration'] = {'spine': {'widthRatio': .04, 'sourceId': 'caa:12', 'basis': 'image-estimate',
                                               'reliefMm': [-.15, 0, .15]}}
        cleaned = clean_entity(self.entity, self.sources)
        self.assertEqual(cleaned['calibration']['spine'], {'widthRatio': .04, 'asset': 'caa-12.png',
            'origin': 'edition-reference', 'sourceUrl': self.sources['caa:12']['sourceUrl'],
            'basis': 'image-estimate', 'reliefMm': [-.15, 0, .15]})
        self.assertNotIn('size', cleaned['packaging'])

    def test_invalid_calibration_or_nonpaper_spine_is_rejected(self):
        baseline = {'widthRatio': .04, 'sourceId': 'caa:12', 'basis': 'image-estimate'}
        invalid = [{'widthRatio': value} for value in (0, -.1, .0009, .2001, 1.01, float('inf'), True, '0.04')]
        invalid += [{'sourceId': 'https://arbitrary.example/image.jpg'}, {'basis': 'measured'}]
        invalid += [{'reliefMm': values} for values in ([0, 0], [0] * 18, [0, .151, 0], [0, float('nan'), 0])]
        for patch in invalid:
            with self.subTest(patch=patch), self.assertRaises(ValidationError):
                self.entity['calibration'] = {'spine': baseline | patch}
                clean_entity(self.entity, self.sources)
        self.entity['packaging']['structure'] = 'jewel'
        self.entity['calibration'] = {'spine': baseline}
        with self.assertRaises(ValidationError): clean_entity(self.entity, self.sources)

    def test_calibration_bounds_and_surface_source_types_are_checked(self):
        for ratio in (.001, .2):
            self.entity['calibration'] = {'spine': {'widthRatio': ratio, 'sourceId': 'caa:12', 'basis': 'image-estimate'}}
            self.assertEqual(clean_entity(self.entity, self.sources)['calibration']['spine']['widthRatio'], ratio)
        for source in ([], {}, 12, None):
            self.entity['surfaces']['front'] = {'sourceId': source}
            with self.subTest(source=source), self.assertRaises(ValidationError): clean_entity(self.entity, self.sources)

    def test_restored_calibration_and_warp_rows_are_validated(self):
        self.entity['surfaces']['spine'] = {'sourceId': 'caa:12', 'warpRows': [[.1, .1, .2, .1], [.1, .9, .2, .9]]}
        self.entity['calibration'] = {'spine': {'widthRatio': .04, 'sourceId': 'caa:12', 'basis': 'image-estimate'}}
        cleaned = clean_entity(self.entity, self.sources); ident = '1' * 32; rid = '2' * 32
        registry = {'epoch': '3' * 32, 'revision': 0, 'latest': {rid: ident}, 'jobs': {ident:
            {'id': ident, 'recordId': rid, 'status': 'succeeded', 'requestId': '4' * 32, 'seq': 0, 'input': {}, 'entity': cleaned}}}
        self.assertEqual(clean_registry(registry), registry)
        for mutate in (lambda e: e['calibration']['spine'].update(widthRatio=.4),
                       lambda e: e['calibration']['spine'].update(asset='../outside.png'),
                       lambda e: e['surfaces']['spine'].update(warpRows=[[.1, .9, .2, .9], [.1, .1, .2, .1]])):
            bad = copy.deepcopy(registry); mutate(bad['jobs'][ident]['entity'])
            with self.assertRaises(ValidationError): clean_registry(bad)


class DiscogsClientTests(unittest.TestCase):
    def test_image_fetch_rejects_nonallowlisted_urls_before_network(self):
        client = DiscogsClient()
        with patch('server.digital_twins.build_opener', side_effect=AssertionError('must not fetch')):
            for url in ('http://i.discogs.com/photo.jpg', 'https://arbitrary.example/photo.jpg',
                        'https://i.discogs.com.arbitrary.example/photo.jpg', 'https://i.discogs.com:8443/photo.jpg',
                        'https://user:pass@i.discogs.com/photo.jpg'):
                with self.subTest(url=url), self.assertRaises(ValidationError): client.image(url)

    def test_metadata_and_image_fetch_are_bounded_and_use_release_api(self):
        calls = []
        class Response:
            def __init__(self, raw): self.raw = raw
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, count): calls.append(('limit', count)); return self.raw
        class Opener:
            def open(self, request, timeout):
                calls.append(('url', request.full_url))
                return Response(b'{"id":2485482,"identifiers":[],"labels":[],"formats":[],"images":[]}')
        with patch('server.digital_twins.build_opener', return_value=Opener()):
            self.assertEqual(DiscogsClient().release('2485482')['id'], 2485482)
        self.assertEqual(calls, [('url', 'https://api.discogs.com/releases/2485482'), ('limit', 2 * 1024 * 1024 + 1)])
        class LargeOpener:
            def open(self, *_args, **_kwargs): return Response(b'x' * (24 * 1024 * 1024 + 1))
        with patch('server.digital_twins.build_opener', return_value=LargeOpener()), self.assertRaises(ValidationError):
            DiscogsClient().image('https://i.discogs.com/photo.jpg')

    def test_redirect_cannot_move_an_image_or_api_request_to_another_host(self):
        from urllib.request import Request
        redirect = DiscogsRedirect()
        for old, target in [('https://i.discogs.com/a.jpg', 'https://arbitrary.example/a.jpg'),
                            ('https://api.discogs.com/releases/1', 'https://i.discogs.com/a.jpg'),
                            ('https://i.discogs.com/a.jpg', 'http://i.discogs.com/a.jpg')]:
            with self.subTest(target=target), self.assertRaises(ValidationError):
                redirect.redirect_request(Request(old), None, 302, '', {}, target)

    def test_invalid_api_collections_and_wrong_release_id_are_unavailable(self):
        client = DiscogsClient()
        for payload in ({'id': 123}, {'id': 2485482, 'images': None}, {'id': 2485482, 'identifiers': 'barcode'}):
            client.read = lambda *_: json.dumps(payload).encode()
            with self.subTest(payload=payload), self.assertRaises(ValidationError): client.release('2485482')


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

    def test_calibration_only_evidence_asset_requires_login_and_publication(self):
        r = self.record(); self.store.save({'id': self.rid, 'revision': r['revision'], 'photos': [PHOTO, PHOTO], 'packaging': FULL})
        original_agent = self.model.agent_json
        def calibrated(skill, instruction, *args, **kwargs):
            result = original_agent(skill, instruction, *args, **kwargs)
            if instruction.startswith('PLAN'): result['sourceIds'] = ['photo:0', 'photo:1']
            if instruction.startswith('BUILD'):
                result['calibration'] = {'spine': {'widthRatio': .03, 'sourceId': 'photo:1', 'basis': 'image-estimate'}}
            return result
        self.model.agent_json = calibrated
        job = self.store.start_twin(self.request())['job']; self.service.run_one()
        _, headers, _ = self.http_req('/api/login', {'password': 'fixture-password-12345'}); cookie = headers['Set-Cookie']
        url = '/api/twin-assets/' + job['id'] + '/photo-1.png'
        self.assertEqual(self.http_req(url, cookie=cookie)[0], 400)
        self.service.confirm({'id': job['id'], 'releaseId': EDITION}); self.service.run_one()
        self.assertEqual(self.http_req(url)[0], 401)
        status, headers, raw = self.http_req(url, cookie=cookie)
        self.assertEqual(status, 200); self.assertEqual(raw, PNG); self.assertTrue(headers['Cache-Control'].startswith('private'))

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
