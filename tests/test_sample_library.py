"""固定测试样本库守护测试：样本清单的不变量（状态数、成本缺失、利润口径、分摊总额、幂等与护栏）。

样本定义在 tools/seed_samples.py；改动样本金额/汇率/清单时这里的精确断言会拦住，
防止之后所有浏览器验收建立在悄悄漂移的样本上。
"""
import importlib.util
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

EXPECTED_STATUS = {'domestic': 8, 'overseas': 5, 'transit': 3, 'shipping': 1,
                   'sold': 3, 'trash': 1}


def load_seed_module():
    spec = importlib.util.spec_from_file_location('seed_samples', ROOT / 'tools' / 'seed_samples.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class SampleLibraryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.seed = load_seed_module()
        cls.tmp = tempfile.TemporaryDirectory()
        cls.dir = Path(cls.tmp.name) / 'samples'
        cls.ids = cls.seed.seed(cls.dir)
        cls.store = cls.seed.open_store(cls.dir)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def state(self):
        return self.store.state()

    def record(self, key):
        return next(r for r in self.state()['records'] if r['id'] == self.ids[key])

    def sale(self, order_id):
        return next(s for s in self.state()['sales'] if s['orderId'] == order_id)

    def shipment(self):
        return self.state()['shipments'][0]

    def test_roster_statuses_and_modules(self):
        st = self.state()
        counts = {}
        for r in st['records']:
            counts[r['status']] = counts.get(r['status'], 0) + 1
        self.assertEqual(counts, EXPECTED_STATUS)
        self.assertEqual(len({(r['title'], r['artist']) for r in st['records']}), 19)
        self.assertEqual(st['modules']['configured'], True)
        self.assertEqual(st['modules']['enabled'], {'acquisition': True, 'trading': True,
                                                    'circulation': True, 'showcase': True})
        self.assertEqual(st['modules']['startPage'], 'domestic')
        self.assertEqual(st['modules']['needsSetup'], False)
        self.assertEqual(len(st['sales']), 2)
        self.assertEqual(len(st['shipments']), 1)

    def test_unknown_cost_is_null_not_zero_and_profit_excluded(self):
        self.assertEqual(self.record('minecraft')['cost'], None)
        self.assertEqual(self.record('moon')['cost'], None)
        self.assertEqual(self.record('remain')['cost'], '49.56')
        sale = self.sale('DEMO-1002')
        profit = {i['recordId']: i['profit'] for i in sale['items']}
        self.assertEqual(profit[self.ids['illinois-en']], '53.69')
        self.assertEqual(profit[self.ids['remain']], '126.84')
        self.assertEqual(profit[self.ids['moon']], None)
        m83 = self.sale('DEMO-1001')
        self.assertEqual(m83['status'], 'shipping')
        self.assertEqual(next(i for i in m83['items'])['profit'], '51.50')

    def test_islands_reference_fixture_starts_without_invented_artwork_or_entity(self):
        self.assertIn('islands-jp', self.ids)
        record = self.record('islands-jp')
        self.assertEqual((record['title'], record['artist'], record['pressing']),
                         ('Islands', 'King Crimson', '日版'))
        self.assertIsNone(record['cost'])
        self.assertEqual(record['photoCount'], 0)
        self.assertFalse(record['cover'])
        self.assertNotIn('barcode', record.get('releaseInfo', {}))
        self.assertNotIn(record['id'], self.store.twin_index()['jobs'])

    def test_default_samples_do_not_fabricate_album_images(self):
        records = self.state()['records']
        self.assertEqual(len(records), 21)
        self.assertTrue(all(not r.get('cover') and not r.get('photoCount') for r in records))
        self.assertTrue(all(not r.get('coverSource') for r in records))
        self.assertTrue(all(not r.get('packaging', {}).get('photos') for r in records))

    def test_listing_photo_fixture_is_opt_in_and_reuses_fixed_copy(self):
        with tempfile.TemporaryDirectory() as directory:
            ids = self.seed.seed_listing_photos(directory)
            store = self.seed.open_store(directory)
            records = store.state()['records']
            self.assertEqual(len(records), 21)
            self.assertEqual(sum(r.get('photoCount', 0) for r in records), 2)
            record = next(r for r in records if r['id'] == ids['lift-fists'])
            self.assertEqual(record['photoCount'], 2)
            self.assertEqual(store.twin_index()['jobs'], {})
            self.assertEqual(self.seed.seed_listing_photos(directory), ids)
        with tempfile.TemporaryDirectory() as directory:
            self.seed.seed(directory)
            with self.assertRaisesRegex(ValueError, '参考图集'):
                self.seed.seed_listing_reference_photos(directory)

    def test_reference_model_plans_use_real_editions_and_separate_printed_faces(self):
        from tools.sample_reference_models import REFERENCE_MODELS
        self.assertEqual(set(REFERENCE_MODELS), set(self.seed.MODEL_SAMPLES))
        for key, plan in REFERENCE_MODELS.items():
            self.assertNotEqual(plan['releaseId'], self.seed.MODEL_SAMPLE_RELEASES[key])
            self.assertFalse(plan['releaseId'].startswith('00000000-'))
            faces = plan['surfaces']
            self.assertNotEqual(faces['front']['sourceId'], faces['back']['sourceId'])
            self.assertNotEqual(faces['front']['sourceId'], faces['disc']['sourceId'])
            self.assertTrue(all(s['sourceId'].startswith(('caa:', 'discogs:')) for s in faces.values()))
        self.assertEqual(REFERENCE_MODELS['loveless']['packaging']['structure'], 'jewel')
        lift = REFERENCE_MODELS['lift-fists']
        self.assertNotEqual(lift['surfaces']['disc']['sourceId'], lift['surfaces']['disc2']['sourceId'])
        self.assertEqual({c['kind'] for c in lift['components']}, {'obi', 'booklet'})
        paper=next(c for c in lift['components'] if c['kind']=='booklet')
        self.assertEqual(paper['fold'],{'pattern':'accordion','panels':4})
        self.assertNotIn('region',paper)
        self.assertNotIn('region',paper['back'])
        illinois=REFERENCE_MODELS['illinois']['components'][0]
        self.assertEqual(illinois['fold'],{'pattern':'accordion','panels':6})
        self.assertNotIn('region',illinois)
        self.assertNotIn('back',illinois)

    def test_reference_publication_replaces_only_geometry_samples_and_is_idempotent(self):
        # Explicit offline transport mock; browser acceptance uses actual fetched originals.
        from tools import seed_reference_models as refs
        from vendor.album_data.contracts import clean_entity
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp) / 'samples'
            ids = self.seed.seed_models(directory)
            store = self.seed.open_store(directory)
            before = {r['id']: r for r in store.state()['records']}

            fingerprint = ['offline-transport-mock']
            with_profile = [True]

            def offline_reference(key, directory, fetcher):
                plan = refs.REFERENCE_MODELS[key]
                selections = list(plan['surfaces'].values()) + plan.get('components', [])
                selections += [part['back'] for part in plan.get('components', []) if part.get('back')]
                sources = {s['sourceId']: {'asset': 'caa-' + str(n) + '.png',
                           'origin': 'edition-reference', 'sourceUrl': 'https://coverartarchive.org/mock'}
                           for n, s in enumerate(selections)}
                profile = self.seed.MODEL_SAMPLE_PRESENTATIONS.get(key) if with_profile[0] else None
                entity = clean_entity({'sameAlbum': True, **{k:plan[k] for k in ('packaging','surfaces','components')},
                    **({'presentation': profile} if profile else {})}, sources)
                originals = {s['asset']: self.seed.model_sample_png() for s in sources.values()}
                return {'id': plan['releaseId'], 'barcode': ''}, {}, entity, originals, fingerprint[0]

            with patch.object(refs, 'load_reference', side_effect=offline_reference):
                first = refs.run(directory)
                second = refs.run(directory)
                self.assertEqual(first, second)
                fingerprint[0] = 'offline-transport-mock-updated-materials'
                with_profile[0] = False
                migrated = refs.run(directory)
                self.assertEqual({key: value['jobId'] for key, value in first.items()},
                                 {key: value['jobId'] for key, value in migrated.items()})
            self.assertEqual(first, second)
            jobs = store.twin_index()['jobs']
            after = {r['id']: r for r in store.state()['records']}
            for key in refs.REFERENCE_MODELS:
                rid = ids[key]
                self.assertEqual(jobs[rid]['status'], 'succeeded')
                self.assertEqual(jobs[rid]['releaseId'], refs.REFERENCE_MODELS[key]['releaseId'])
                self.assertEqual(after[rid]['photoCount'], 0)
                self.assertEqual(after[rid]['price'], before[rid]['price'])
                self.assertEqual(after[rid]['status'], before[rid]['status'])
                self.assertEqual(jobs[rid]['entity']['document']['schemaVersion'], 2)
                booklet = next(c for c in jobs[rid]['entity']['document']['assembly']['components'] if c['kind'] == 'booklet')
                expected=next(c for c in refs.REFERENCE_MODELS[key]['components'] if c['kind']=='booklet')
                if key in self.seed.MODEL_SAMPLE_PRESENTATIONS:
                    self.assertEqual(jobs[rid]['entity']['document']['presentation'], self.seed.MODEL_SAMPLE_PRESENTATIONS[key])
                self.assertEqual('back' in booklet['surfaces'],'back' in expected)
                if expected.get('fold'):
                    self.assertEqual(booklet['fold'],expected['fold'])
                    self.assertNotIn('region',booklet['surfaces']['front'])
                if key=='lift-fists':
                    self.assertNotIn('region',booklet['surfaces']['back'])
            for key in ids.keys() - refs.REFERENCE_MODELS.keys():
                self.assertEqual(after[ids[key]], before[ids[key]])

    def test_reference_cache_rejects_wrong_edition_before_loading_images(self):
        from tools import seed_reference_models as refs
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            (directory / 'manifest.json').write_text(json.dumps({'releaseId': 'wrong'}))
            (directory / 'release.json').write_text(json.dumps({'id': 'wrong'}))
            with self.assertRaisesRegex(ValueError, 'different release'):
                refs.load_reference('lift-fists', directory, refs.artwork_fetcher())

    def test_reference_fetch_failure_leaves_next_retry_usable(self):
        from tools import seed_reference_models as refs
        from types import SimpleNamespace
        calls = []

        def unavailable(release_id, directory):
            directory.mkdir()
            calls.append(release_id)
            raise OSError('offline transport fixture')

        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp) / 'lift-fists'
            for _ in range(2):
                with self.assertRaisesRegex(OSError, 'offline transport fixture'):
                    refs.load_reference('lift-fists', directory, SimpleNamespace(fetch=unavailable))
                self.assertFalse(directory.exists())
            self.assertEqual(len(calls), 2)

    def test_allocation_totals_preserved_with_remainder(self):
        s = self.shipment()
        self.assertEqual(s['currency'], 'JPY')
        self.assertEqual(sum(Decimal(i['fee']) for i in s['items']), Decimal(s['cost']))
        self.assertEqual(sum(Decimal(i['feeOriginal']) for i in s['items']),
                         Decimal(s['costOriginal']))
        self.assertEqual([i['fee'] for i in s['items']], ['35.39', '35.38', '35.38'])
        self.assertEqual([i['feeOriginal'] for i in s['items']],
                         ['749.67', '749.67', '749.66'])
        self.assertEqual(self.record('yehui')['fees'], '35.39')
        sale = self.sale('DEMO-1002')
        self.assertEqual(sum(Decimal(i['gross']) for i in sale['items']), Decimal(sale['gross']))
        self.assertEqual(sum(Decimal(i['grossOriginal']) for i in sale['items']),
                         Decimal(sale['grossOriginal']))
        self.assertEqual([i['grossOriginal'] for i in sale['items']],
                         ['4266.67', '4266.67', '4266.66'])

    def test_listed_shipping_and_trash_states(self):
        m83 = self.record('m83')
        self.assertEqual(m83['status'], 'shipping')
        self.assertEqual(m83['listed'], True)
        self.assertTrue(m83.get('saleId'))
        self.assertEqual(m83['listingChannel'], '示例二手平台')
        self.assertEqual(self.record('first-love')['status'], 'trash')

    def test_showcase_group_ordered_members(self):
        groups = self.state()['settings']['showcase-groups-v1']['groups']
        self.assertEqual([g['name'] for g in groups], ['示例精选'])
        self.assertEqual(groups[0]['recordIds'],
                         [self.ids['parachutes'], self.ids['tasogare'], self.ids['loveless']])
        known = {r['id'] for r in self.state()['records']}
        self.assertTrue(set(groups[0]['recordIds']) <= known)

    def test_reseed_is_idempotent(self):
        before = self.state()
        again = self.seed.seed(self.dir)
        self.assertEqual(again, self.ids)
        after = self.state()
        self.assertEqual(len(after['records']), len(before['records']))
        self.assertEqual(len(after['sales']), len(before['sales']))

    def test_model_samples_publish_only_synthetic_entities_and_are_idempotent(self):
        with tempfile.TemporaryDirectory() as folder:
            ids = self.seed.seed(folder)
            self.seed.seed_models(folder)
            model_state = self.seed.open_store(folder)
            records_by_id = {record['id']:record for record in model_state.state()['records']}
            sample_ids = self.seed.seed(folder)
            for key, release in self.seed.MODEL_SAMPLE_RELEASES.items():
                self.assertEqual(records_by_id[sample_ids[key]]['releaseInfo']['musicBrainzReleaseId'], release)
                self.assertEqual(model_state.twin_index()['jobs'][sample_ids[key]]['releaseId'], release)
                offline = json.loads((Path(folder)/'sample-catalog-artwork.json').read_text())[release]
                self.assertEqual(offline['source'],'synthetic-sample')
                self.assertEqual(records_by_id[sample_ids[key]]['photoCount'], 5 if key == 'lift-fists' else 1)
                self.assertIn('非发行版证据',offline['artwork'][0]['types'][0])

            store = self.seed.open_store(folder)
            jobs = store.twin_index()['jobs']
            self.assertEqual(set(jobs), {ids[key] for key in ('lift-fists', 'loveless', 'illinois')})
            for job in jobs.values():
                self.assertEqual(job['status'], 'succeeded')
                self.assertIn('合成', job['message'])
                self.assertEqual(job['entity']['document']['schemaVersion'], 2)
                self.assertEqual(store.published_twin_asset(job['id'], 'photo-0.png').read_bytes()[:8], b'\x89PNG\r\n\x1a\n')
            camera = self.seed.MODEL_SAMPLE_PRESENTATIONS['illinois']
            self.assertEqual(jobs[ids['illinois']]['entity']['presentation'], camera)
            self.assertEqual(jobs[ids['illinois']]['entity']['document']['presentation'], camera)
            self.assertEqual(jobs[ids['lift-fists']]['entity']['packaging']['pocketOpening'], 'inner')
            self.assertEqual(jobs[ids['lift-fists']]['entity']['surfaces']['disc']['asset'], 'photo-1.png')
            self.assertTrue(store.published_twin_asset(jobs[ids['lift-fists']]['id'], 'photo-1.png').read_bytes().startswith(b'\x89PNG'))

            parts = jobs[ids['lift-fists']]['entity']['components']
            self.assertEqual([part['kind'] for part in parts],['obi','booklet','inner-sleeve'])
            self.assertEqual([part['asset'] for part in parts], ['photo-2.png', 'photo-3.png', 'photo-4.png'])
            for part in parts:
                self.assertTrue(store.published_twin_asset(jobs[ids['lift-fists']]['id'], part['asset']).read_bytes().startswith(b'\x89PNG'))
            faces = jobs[ids['lift-fists']]['entity']['surfaces']
            self.assertEqual(faces['front']['region'], self.seed.MODEL_SAMPLE_REGIONS['front'])
            self.assertNotEqual(faces['front']['region'], faces['back']['region'])
            self.assertEqual(faces['insideRight']['warpRows'], self.seed.MODEL_SAMPLE_WARP)
            pixels = self.seed.model_sample_pixels()
            self.assertEqual(pixels[:4], bytes([245, 245, 245, 255]))
            self.assertNotEqual(pixels[(32 * 128 + 32) * 4:(32 * 128 + 32) * 4 + 3],
                                pixels[(32 * 128 + 96) * 4:(32 * 128 + 96) * 4 + 3])
            self.assertEqual(jobs[ids['loveless']]['entity']['packaging']['structure'], 'card-sleeve')
            before = store.state()
            self.seed.seed_models(folder)
            self.assertEqual(store.twin_index()['jobs'], jobs)
            self.assertEqual(store.state()['records'], before['records'])

    def test_guards_refuse_foreign_and_repo_targets(self):
        with self.assertRaises(SystemExit):
            self.seed.seed(ROOT / 'data')
        with tempfile.TemporaryDirectory() as other:
            con = sqlite3.connect(Path(other) / 'albums.sqlite3')
            con.execute('CREATE TABLE meta(key TEXT PRIMARY KEY, data TEXT)')
            con.commit(); con.close()
            with self.assertRaises(SystemExit):
                self.seed.seed(other)


class EngineFixtureExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.seed = load_seed_module()

    def test_cli_exports_existing_model_samples_without_database(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'fixtures'
            result = subprocess.run(
                [sys.executable, str(ROOT / 'tools' / 'seed_samples.py'),
                 '--export-engine-fixtures', str(target)],
                cwd=ROOT, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual({p.name for p in target.iterdir()},
                             {'entities.json', 'sample-scan.png', 'sample-disc.png', 'pixels.json',
                              'sample-obi.png', 'sample-booklet.png', 'sample-inner-sleeve.png', 'model-variants.json'})
            entities = json.loads((target / 'entities.json').read_text())
            self.assertEqual([e['key'] for e in entities], ['lift-fists', 'loveless', 'illinois'])
            self.assertEqual([e['title'] for e in entities],
                             ['Lift Your Skinny Fists Like Antennas to Heaven', 'Loveless', 'Illinois'])
            for entity in entities:
                expected = {'schemaVersion', 'key', 'title', 'packaging', 'surfaces', 'document'}
                if entity['key'] == 'lift-fists':
                    expected.add('components')
                    self.assertEqual(len(entity['components']),3)
                if entity['key'] in self.seed.MODEL_SAMPLE_PRESENTATIONS:
                    expected.add('presentation')
                    self.assertEqual(entity['presentation'], self.seed.MODEL_SAMPLE_PRESENTATIONS[entity['key']])
                    self.assertEqual(entity['document']['presentation'], entity['presentation'])
                self.assertEqual(set(entity), expected)
                self.assertEqual(entity['schemaVersion'], 1)
                self.assertEqual(entity['document']['schemaVersion'], 2)
                self.assertEqual(entity['packaging'], self.seed.MODEL_SAMPLES[entity['key']])
                self.assertEqual(set(entity['surfaces']),
                                 {'front', 'back', 'insideLeft', 'insideRight', 'disc', 'disc2'})
                for role, surface in entity['surfaces'].items():
                    self.assertEqual(surface['asset'],
                                     'sample-disc.png' if entity['key'] == 'lift-fists' and role == 'disc'
                                     else 'sample-scan.png')
                    self.assertEqual(surface['origin'], 'synthetic-sample')
                    self.assertEqual(surface['sourceUrl'], '')
                    if role in self.seed.MODEL_SAMPLE_REGIONS:
                        self.assertEqual(surface['region'], self.seed.MODEL_SAMPLE_REGIONS[role])
                    else:
                        self.assertNotIn('region', surface)
                    if role == 'insideRight':
                        self.assertEqual(surface['warpRows'],
                                         [[.5, .5, .9375, .5], [.51, .72, .92, .74],
                                          [.5, .9375, .9375, .9375]])
                    else:
                        self.assertNotIn('warpRows', surface)
            self.assertEqual((target / 'sample-scan.png').read_bytes(), self.seed.model_sample_png())
            from vendor.album_engine.document import model_contract, validate_document
            variants = json.loads((target / 'model-variants.json').read_text())
            self.assertEqual({item['document']['assembly']['components'][0]['definition'] for item in variants}, set(model_contract()['models']))
            for item in variants:
                validate_document(item['document'])
            folds={item['key']:next(c['fold']['panels'] for c in item['document']['assembly']['components'] if c.get('fold'))
                   for item in variants if any(c.get('fold') for c in item['document']['assembly']['components'])}
            self.assertEqual(folds,{'rig-jewel-case':6,'rig-gatefold-2-inner':4})
            pixels = json.loads((target / 'pixels.json').read_text())
            self.assertEqual((pixels['width'], pixels['height'], pixels['channels']), (128, 128, 4))
            self.assertEqual(len(pixels['pixels']), 128 * 128 * 4)
            self.assertEqual(pixels['pixels'][:4], [245, 245, 245, 255])
            offset = (32 * 128 + 32) * 4
            self.assertEqual(pixels['pixels'][offset:offset + 4], [45, 95, 130, 255])
            self.assertEqual(bytes(pixels['pixels']), self.seed.model_sample_pixels())
            before = {p.name: p.read_bytes() for p in target.iterdir()}
            self.seed.export_engine_fixtures(target)
            self.assertEqual({p.name: p.read_bytes() for p in target.iterdir()}, before)

    def test_export_refuses_real_repo_data_directory(self):
        with self.assertRaises(SystemExit):
            self.seed.export_engine_fixtures(ROOT / 'data')


if __name__ == '__main__':
    unittest.main()
