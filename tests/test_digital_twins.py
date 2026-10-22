"""宿主侧数字实体的存储事务：任务、租约、围栏、发布、校准、备份恢复与资产鉴权。

生成规则（素材规划、贴图、校准推断）属于 Album Engine 项目，随插件包测试；这里用
最小的 Publisher 走插件 worker 所用的同一组 Store 事务（领取 → 写素材 → 发布）。
"""
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
from types import SimpleNamespace

from domain import ValidationError, ConflictError
from storage import Store, uid
from server import Services, make_handler
from security import Auth
from twins import TWIN_KEY, clean_entity, clean_registry

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')
PHOTO = 'data:image/png;base64,' + base64.b64encode(PNG).decode()
EDITION = '11111111-1111-4111-8111-111111111111'
BARCODE = '4988013047105'
FULL = {'structure': 'gatefold', 'panels': 2, 'holder': 'pocket', 'pockets': 'both', 'pocketOpening': 'inner', 'discs': 2,
        'photos': {role: 0 for role in ('front', 'back', 'insideLeft', 'insideRight', 'disc', 'disc2')}}
PACKAGE = {k: v for k, v in FULL.items() if k != 'photos'}


def plan(**extra):
    return {'sameAlbum': True, 'packaging': PACKAGE, 'surfaces': {role: {'sourceId': 'photo:0'} for role in FULL['photos']}, **extra}


class Publisher:
    """插件 worker 的替身：只调用 TaskAdapter 暴露的 Store 事务，不含任何生成规则。"""
    def __init__(self, store): self.store = store
    def run_one(self, spec=None):
        job = self.store.claim_twin('fixture-worker')
        if not job: return False
        entity = clean_entity(spec or plan(), job['sources'])
        self.store.update_twin(job['id'], job['claim'], status='succeeded', phase='published',
                               releaseId=job['selectedReleaseId'], entity=entity)
        return True


class DigitalTwinTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.store = Store(Path(self.tmp.name) / 'albums.sqlite3')
        self.store.set_modules({'showcase': True, 'acquisition': False, 'trading': False, 'circulation': False})
        self.rid = self.store.save({'title': 'Test Album', 'artist': 'Test Artist',
                                    'releaseInfo': {'barcode':BARCODE,'musicBrainzReleaseId':EDITION},
                                    'photos': [PHOTO], 'packaging': FULL})['ids'][0]
        self.service = Publisher(self.store)

    def tearDown(self): self.tmp.cleanup()
    def record(self): return next(r for r in self.store.state()['records'] if r['id'] == self.rid)
    def request(self, **patch): return {'recordId': self.rid, 'recordRevision': self.record()['revision'], 'requestId': uid(), **patch}
    def create(self, **patch): return self.store.start_twin(self.request(**patch))['job']
    def publish(self, spec=None):
        self.create(); self.service.run_one(spec)
        return self.store.twin_index()['jobs'][self.rid]

    def test_saved_release_is_reused_without_second_selection(self):
        """Barcode -> release UUID persisted on copy -> twin task uses the same UUID."""
        record = self.record()
        self.store.save({'id': self.rid, 'revision': record['revision'],
                         'releaseInfo': {'barcode': BARCODE, 'musicBrainzReleaseId': EDITION}})
        with_store = Store(self.store.path)
        persisted = next(r for r in with_store.state()['records'] if r['id'] == self.rid)
        self.assertEqual(persisted['releaseInfo']['musicBrainzReleaseId'], EDITION)
        request = self.request(barcode='')
        job = self.store.start_twin(request)['job']
        self.assertEqual(job['barcodeSource'], 'record')
        self.assertEqual(self.store.claim_twin('worker')['selectedReleaseId'], EDITION)

    def test_publication_uses_persisted_release_and_lost_request_is_idempotent(self):
        request = self.request()
        job = self.store.start_twin(request)['job']; self.service.run_one()
        finished = self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(finished['status'], 'succeeded')
        self.assertEqual(finished['releaseId'], EDITION)
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
        self.assertTrue(self.service.run_one())
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'succeeded')
        self.assertFalse(self.service.run_one())

    def test_lost_response_receipt_remains_idempotent_after_completion(self):
        body = self.request(); first = self.store.start_twin(body)['job']; self.service.run_one()
        for _ in range(5): self.assertEqual(self.store.start_twin(body)['job']['id'], first['id'])
        self.assertEqual(self.create()['id'], first['id'])

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

    def test_post_publication_disc_calibration_is_persistent_and_reversible(self):
        """Edit the printed CD without replacing the published entity or editing album records."""
        job = self.publish()
        record = copy.deepcopy(self.record())
        original = self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(original['status'], 'succeeded')
        ellipse = {'cx': .48, 'cy': .51, 'rx': .43, 'ry': .34, 'angle': .12}
        cal = {'source': 'manual', 'outer': ellipse,
               'inner': {'cx': .49, 'cy': .50, 'rx': .09, 'ry': .07, 'angle': .12}}
        result = self.store.set_twin_disc_calibration({'id': job['id'], 'role': 'disc', 'calibration': cal})
        updated = result['job']
        self.assertEqual(updated['status'], 'succeeded')
        self.assertEqual(updated['entity']['surfaces']['disc']['discCalibration'], cal)
        self.assertEqual(self.record(), record)
        self.assertEqual(self.store.start_twin(self.request())['job']['id'], job['id'])
        self.assertEqual(Store(self.store.path).twin_index()['jobs'][self.rid]['entity']['surfaces']['disc']['discCalibration'], cal)
        backup = self.store.backup()
        self.assertEqual(backup['settings'][TWIN_KEY]['jobs'][job['id']]['entity']['surfaces']['disc']['discCalibration'], cal)
        self.store.set_twin_disc_calibration({'id': job['id'], 'role': 'disc', 'calibration': None})
        self.assertNotIn('discCalibration', self.store.twin_index()['jobs'][self.rid]['entity']['surfaces']['disc'])

    def test_disc_calibration_rejects_wrong_surface_and_invalid_ellipses(self):
        job = self.publish()
        base = {'id': job['id'], 'role': 'disc'}
        invalid = [
            {'source': 'manual', 'outer': {'cx': .99, 'cy': .5, 'rx': .4, 'ry': .4, 'angle': 0}},
            {'source': 'manual', 'outer': {'cx': .5, 'cy': .5, 'rx': .4, 'ry': 0, 'angle': 0}},
            {'source': 'manual', 'outer': {'cx': .5, 'cy': .5, 'rx': .4, 'ry': .4, 'angle': float('nan')}},
        ]
        for cal in invalid:
            with self.assertRaises(ValidationError):
                self.store.set_twin_disc_calibration({**base, 'calibration': cal})
        with self.assertRaises(ValidationError):
            self.store.set_twin_disc_calibration({**base, 'role': 'front', 'calibration': None})
        with self.assertRaises(ValidationError):
            self.store.set_twin_disc_calibration({**base, 'role': 'disc4', 'calibration': None})

    def test_pre_release_uuid_published_entity_survives_upgrade(self):
        """An old successful task remains visible when only the snapshot schema changes."""
        job = self.publish()
        with self.store.connect() as db:
            registry = self.store.meta_get(db, TWIN_KEY)
            registry['jobs'][job['id']]['input']['releaseInfo'].pop('musicBrainzReleaseId')
            db.execute('UPDATE meta SET data=? WHERE key=?', (json.dumps(registry), TWIN_KEY))
            db.commit()

        before = self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(before['status'], 'stale')
        self.assertIsNone(before['entity'])

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

    def test_cancelled_result_and_working_files_cannot_be_published(self):
        job = self.create(); claim = self.store.claim_twin('worker'); self.store.cancel_twin(job['id'])
        self.assertFalse(self.store.update_twin(job['id'], claim['claim'], status='succeeded', entity={}))
        with self.assertRaises(ValidationError): self.store.published_twin_asset(job['id'], 'photo-0.png')

    def test_backup_restore_interrupts_tasks_without_replaying_them(self):
        first = self.create(); self.store.claim_twin('worker')
        backup = copy.deepcopy(self.store.backup()); self.store.restore_backup(backup)
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'], 'interrupted')
        self.assertFalse(self.service.run_one())

    def test_ready_backup_restored_without_asset_files_returns_2d_state(self):
        self.publish(); backup = copy.deepcopy(self.store.backup())
        with tempfile.TemporaryDirectory() as other:
            restored = Store(Path(other) / 'albums.sqlite3'); restored.restore_backup(backup)
            self.assertEqual(restored.twin_index()['jobs'][self.rid]['status'], 'interrupted')

    def test_generation_requires_persisted_release_uuid_never_photo_ocr(self):
        record = self.record()
        self.store.save({'id': self.rid, 'revision': record['revision'],
                         'releaseInfo': {'barcode': BARCODE, 'musicBrainzReleaseId': ''}})
        with self.assertRaisesRegex(ValidationError, '确认 MusicBrainz'):
            self.create()
        self.assertFalse(self.service.run_one())

    def test_start_rejects_standalone_barcode_even_if_valid(self):
        with self.assertRaisesRegex(ValidationError, '不得另传条码'):
            self.create(barcode=BARCODE)

    def test_unknown_or_missing_surfaces_and_bad_regions_do_not_become_ready(self):
        source = {'photo:0': {'asset': 'photo-0.png'}}
        for spec in [ {'sameAlbum': True, 'packaging': {'structure': 'gatefold'}, 'surfaces': {}},
                      {'sameAlbum': True, 'packaging': {'structure': 'unknown'}, 'surfaces': {}},
                      {'sameAlbum': True, 'packaging': {'structure': 'gatefold'}, 'surfaces': {'front': {'sourceId': 'other'}}}]:
            with self.assertRaises(ValidationError): clean_entity(spec, source)

    def test_spine_and_surface_calibration_survives_restore_without_ledger_changes(self):
        original = copy.deepcopy(self.record())
        rows = [[.2, .1, .3, .1], [.21, .5, .31, .5], [.2, .9, .3, .9]]
        spec = plan(calibration={'spine': {'widthRatio': .035, 'sourceId': 'photo:0',
                                           'basis': 'image-estimate', 'reliefMm': [-.1, 0, .1]}})
        spec['surfaces']['spine'] = {'sourceId': 'photo:0', 'warpRows': rows}
        job = self.publish(spec)
        self.assertEqual(job['entity']['surfaces']['spine']['warpRows'], rows)
        self.assertEqual(job['entity']['calibration'], {'spine': {'widthRatio': .035, 'asset': 'photo-0.png',
            'sourceUrl': '', 'origin': 'record-photo', 'basis': 'image-estimate', 'reliefMm': [-.1, 0, .1]}})
        backup = copy.deepcopy(self.store.backup()); self.store.restore_backup(backup)
        restored = self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(restored['entity'], job['entity'])
        self.assertEqual(self.record(), original)

    def test_calibration_evidence_asset_is_published_and_missing_file_revokes_ready_state(self):
        r = self.record(); self.store.save({'id': self.rid, 'revision': r['revision'], 'photos': [PHOTO, PHOTO], 'packaging': FULL})
        job = self.publish(plan(calibration={'spine': {'widthRatio': .035, 'sourceId': 'photo:1', 'basis': 'image-estimate'}}))
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


class TwinHttpTests(unittest.TestCase):
    record = DigitalTwinTests.record
    request = DigitalTwinTests.request
    create = DigitalTwinTests.create
    def setUp(self):
        DigitalTwinTests.setUp(self); self.auth = Auth(Path(self.tmp.name) / 'auth.sqlite3'); self.auth.set_password('fixture-password-12345')
        self.previews = []
        twins = SimpleNamespace(index=self.store.twin_index,
                                guided_image=lambda ident, ordinal, source=None: self.previews.append((ident, ordinal, source)) or PNG)
        self.http = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(Services(store=self.store, auth=self.auth, twins=twins)))
        threading.Thread(target=self.http.serve_forever, daemon=True).start()

    def tearDown(self): self.http.shutdown(); self.http.server_close(); DigitalTwinTests.tearDown(self)
    def http_req(self, path, body=None, cookie=None, origin=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.http.server_port)
        headers = {'Content-Type': 'application/json'}
        if cookie: headers['Cookie'] = cookie
        if origin: headers['Origin'] = origin
        connection.request('GET' if body is None else 'POST', path, json.dumps(body) if body is not None else None, headers)
        response = connection.getresponse(); result = response.status, dict(response.headers), response.read(); connection.close(); return result
    def login(self):
        return self.http_req('/api/login', {'password': 'fixture-password-12345'})[1]['Set-Cookie']

    def test_http_auth_origin_and_published_assets(self):
        for route in ['/api/twins', '/api/twin-assets/' + uid() + '/photo-0.png']:
            self.assertEqual(self.http_req(route)[0], 401)
        cookie = self.login()
        body = self.request()
        # 宿主不再提供生成入口（D-005）；任务由存储层直接创建，只验证资产访问的鉴权与发布边界。
        for route in ('/api/twins/start', '/api/twins/spine'):
            self.assertEqual(self.http_req(route, body, cookie)[0], 404)
        self.assertEqual(self.http_req('/api/catalog/artwork?id=' + EDITION, cookie=cookie)[0], 404)
        task = self.store.start_twin(body)['job']; self.assertEqual(self.http_req('/api/twin-assets/' + task['id'] + '/photo-0.png', cookie=cookie)[0], 400)
        self.assertEqual(self.http_req('/api/twins/confirm', {'id': task['id'], 'releaseId': EDITION}, cookie, 'https://evil.example')[0], 403)
        self.assertEqual(self.http_req('/api/twins/confirm', {'id': task['id'], 'releaseId': EDITION}, cookie)[0], 404)
        Publisher(self.store).run_one()
        status, _, raw = self.http_req('/api/twins', cookie=cookie)
        self.assertEqual(status, 200); self.assertEqual(json.loads(raw)['jobs'][self.rid]['status'], 'succeeded')
        status, _, raw = self.http_req('/api/twin-assets/' + task['id'] + '/photo-0.png', cookie=cookie)
        self.assertEqual(status, 200); self.assertEqual(raw, PNG)
        self.assertEqual(self.http_req('/api/twin-assets/' + task['id'] + '/cover.tmp', cookie=cookie)[0], 400)

    def test_source_preview_is_a_prefix_route_behind_login(self):
        """I-007：附件编辑器请求 /api/twin-source-preview/<任务>/<序号>?source=…，必须按前缀命中。"""
        ident = uid(); url = '/api/twin-source-preview/' + ident + '/3?source=caa%3A101'
        self.assertEqual(self.http_req(url)[0], 401)
        status, headers, raw = self.http_req(url, cookie=self.login())
        self.assertEqual(status, 200); self.assertEqual(raw, PNG); self.assertTrue(headers['Cache-Control'].startswith('private'))
        self.assertEqual(self.previews, [(ident, 3, 'caa:101')])

    def test_calibration_only_evidence_asset_requires_login_and_publication(self):
        r = self.record(); self.store.save({'id': self.rid, 'revision': r['revision'], 'photos': [PHOTO, PHOTO], 'packaging': FULL})
        job = self.create(); cookie = self.login()
        url = '/api/twin-assets/' + job['id'] + '/photo-1.png'
        self.assertEqual(self.http_req(url, cookie=cookie)[0], 400)
        Publisher(self.store).run_one(plan(calibration={'spine': {'widthRatio': .03, 'sourceId': 'photo:1', 'basis': 'image-estimate'}}))
        self.assertEqual(self.http_req(url)[0], 401)
        status, headers, raw = self.http_req(url, cookie=cookie)
        self.assertEqual(status, 200); self.assertEqual(raw, PNG); self.assertTrue(headers['Cache-Control'].startswith('private'))

    def test_review_artwork_is_protected_and_not_published_entity_artwork(self):
        cookie = self.login()
        task = self.create(); claim = self.store.claim_twin('worker')['claim']
        self.store.write_twin_source(task['id'], claim, 'caa-123.png', PNG)
        self.store.update_twin(task['id'], claim, candidates=[{'artwork': [{'previewAsset': 'caa-123.png'}]}])
        url = '/api/twin-review-assets/' + task['id'] + '/caa-123.png'
        self.assertEqual(self.http_req(url)[0], 401)
        status, headers, raw = self.http_req(url, cookie=cookie)
        self.assertEqual(status, 200); self.assertEqual(raw, PNG); self.assertTrue(headers['Cache-Control'].startswith('private'))
        self.assertEqual(self.http_req('/api/twin-review-assets/' + task['id'] + '/photo-0.png', cookie=cookie)[0], 400)
        self.assertEqual(self.http_req('/api/twin-assets/' + task['id'] + '/caa-123.png', cookie=cookie)[0], 400)


if __name__ == '__main__': unittest.main()
