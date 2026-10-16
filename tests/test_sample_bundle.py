"""Offline transport fixtures exercise the real fixed roster and publication path."""
from copy import deepcopy
import json
from pathlib import Path
import tempfile
import shutil
import unittest
from unittest.mock import patch

from tools import sample_bundle as workflow
from tools.preview_samples import backup, restore_snapshot, prepare
from tools.seed_samples import RECORDS, model_sample_png, open_store
from tools.sample_reference_models import REFERENCE_MODELS


def offline_bundle(root):
    raw = model_sample_png(); sha = workflow.digest(raw)
    asset = {'file': sha + '.png', 'bytes': len(raw), 'url': 'https://coverartarchive.org/test.png'}
    manifest = {'schemaVersion':1,'sampleVersion':'offline-test-1','contract':workflow.contract(),
                'assets':{sha:asset},'covers':{},'references':{}}
    for key, fixed in RECORDS:
        source = {'provider':'offline-test','url':asset['url']}
        if key in REFERENCE_MODELS:
            plan = REFERENCE_MODELS[key]
            sid = plan['surfaces']['front']['sourceId']
            source = {'provider':'Edition reference','url': 'https://coverartarchive.org/' + sid,
                      'page':'https://musicbrainz.org/release/' + plan['releaseId'],
                      'title':fixed['title'],'artist':fixed['artist']}
        manifest['covers'][key] = {'asset':sha, 'source':source}
    for key, plan in REFERENCE_MODELS.items():
        entries = list(plan['surfaces'].values()) + plan['components']
        entries += [p['back'] for p in plan['components'] if p.get('back')]
        images, files = [], {}
        for sid in sorted({e['sourceId'] for e in entries}):
            filename = sid.split(':')[1] + '.png' if sid.startswith('caa:') else sid.replace(':','-') + '.png'
            files[filename] = sha
            images.append({'sourceId':sid,'file':filename,'status':'downloaded','pixels':[128,128],
                           'bytes':len(raw),'sourceUrl':'https://coverartarchive.org/' + sid})
        discogs = {i['sourceId'].split(':')[1]:{} for i in images if i['sourceId'].startswith('discogs:')}
        manifest['references'][key] = {'release':{'id':plan['releaseId'],'media':[{'format':'CD'}]},
            'manifest':{'releaseId':plan['releaseId'],'images':images},'files':files,'discogs':discogs}
    bundle = root / 'bundle'; (bundle / 'assets').mkdir(parents=True)
    (bundle / 'assets' / asset['file']).write_bytes(raw)
    lock = root / 'lock.json'; lock.write_bytes(workflow.encoded(manifest))
    (bundle / 'manifest.json').write_bytes(workflow.encoded(manifest))
    return bundle, lock, manifest


class SampleBundleTests(unittest.TestCase):
    def test_fresh_offline_restore_and_reopen_keep_all_covers_and_3d_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); bundle, lock, _ = offline_bundle(root)
            fetcher = workflow.artwork_fetcher()
            with (patch('urllib.request.urlopen', side_effect=AssertionError('offline')),
                  patch.object(fetcher, 'verify_discogs', return_value=True),
                  patch('tools.seed_reference_models.artwork_fetcher', return_value=fetcher)):
                data = root / 'instance'
                first = workflow.restore(bundle, data, lock)
                before = open_store(data).state()['records']
                second = workflow.restore(bundle, data, lock)
                self.assertEqual(first, second)
                self.assertEqual(before, open_store(data).state()['records'])
                self.assertEqual((first['covers'], len(first['models'])), (21, 3))
                snapshot = backup(data, root / 'complete.tar.gz', bundle, lock)
                shutil.rmtree(bundle)
                restored = restore_snapshot(snapshot, root / 'restored', bundle, lock)
                self.assertEqual(first, restored)
                # A bad snapshot cannot leave a half-imported target blocking retry.
                bad = root / 'truncated.tar.gz'; bad.write_bytes(snapshot.read_bytes()[:80])
                with self.assertRaises(Exception):
                    restore_snapshot(bad, root / 'retry', bundle, lock)
                self.assertFalse((root / 'retry').exists())
                self.assertEqual(first, restore_snapshot(snapshot, root / 'retry', bundle, lock))
                # Existing database rows are not enough: inspect published bytes too.
                broken = first['models'][0]['assets'][0]['url'].split('/')[-1]
                path = data / 'digital-twins' / first['models'][0]['jobId'] / broken
                path.write_bytes(b'corrupted after publication')
                with self.assertRaisesRegex(ValueError, '贴图损坏'):
                    workflow.check(bundle, data, lock)

    def test_missing_or_corrupt_bundle_fails_before_creating_instance(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); bundle, lock, manifest = offline_bundle(root)
            asset = bundle / 'assets' / next(iter(manifest['assets'].values()))['file']
            asset.write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError, '损坏'):
                workflow.restore(bundle, root / 'instance', lock)
            self.assertFalse((root / 'instance').exists())

    def test_changed_engine_contract_is_not_silently_accepted(self):
        with tempfile.TemporaryDirectory() as temp:
            bundle, lock, manifest = offline_bundle(Path(temp))
            manifest['contract']['engineVersion'] = 'old'
            lock.write_bytes(workflow.encoded(manifest))
            with self.assertRaisesRegex(ValueError, '不匹配'):
                workflow.verify(bundle, lock)

    def test_identical_asset_set_with_wrong_face_binding_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); bundle, lock, _ = offline_bundle(root)
            fetcher = workflow.artwork_fetcher()
            with (patch.object(fetcher, 'verify_discogs', return_value=True),
                  patch('tools.seed_reference_models.artwork_fetcher', return_value=fetcher)):
                data = root / 'instance'; workflow.restore(bundle, data, lock)
            store = open_store(data); index = deepcopy(store.twin_index())
            job = next(iter(index['jobs'].values()))
            root_component = job['entity']['document']['assembly']['components'][0]
            root_component['surfaces']['front'], root_component['surfaces']['back'] = (
                root_component['surfaces']['back'], root_component['surfaces']['front'])
            with patch.object(store, 'twin_index', return_value=index), patch.object(workflow, 'open_store', return_value=store):
                with self.assertRaisesRegex(ValueError, '印刷面绑定'):
                    workflow.check(bundle, data, lock)

    def test_apple_volatile_comment_does_not_change_artwork_identity(self):
        # Minimal big-endian TIFF: root IFD -> Exif IFD -> 8-byte UserComment.
        exif = (b'Exif\x00\x00MM\x00*\x00\x00\x00\x08'
                + b'\x00\x01\x87i\x00\x04\x00\x00\x00\x01\x00\x00\x00\x1a' + bytes(4)
                + b'\x00\x01\x92\x86\x00\x07\x00\x00\x00\x08\x00\x00\x00,' + bytes(4))
        def jpeg(comment):
            payload = exif + comment
            return b'\xff\xd8\xff\xe1' + (len(payload) + 2).to_bytes(2,'big') + payload + b'\xff\xda' + b'same encoded pixels'
        url = 'https://is1-ssl.mzstatic.com/art.jpg'
        first, second = jpeg(b'one-one1'), jpeg(b'two-two2')
        self.assertEqual(workflow.canonical_image(first,url), workflow.canonical_image(second,url))
        self.assertTrue(workflow.canonical_image(first,url).endswith(b'same encoded pixels'))
        self.assertEqual(workflow.canonical_image(first,'https://coverartarchive.org/a.jpg'),first)

    def test_upgrade_archives_old_bundle_before_installing_new_version(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp); assets, lock, old = offline_bundle(home)
            fetcher = workflow.artwork_fetcher()
            with (patch.object(fetcher, 'verify_discogs', return_value=True),
                  patch('tools.seed_reference_models.artwork_fetcher', return_value=fetcher)):
                first = workflow.restore(assets, home / 'instance', lock)
                new = deepcopy(old); new['sampleVersion'] = 'offline-test-2'
                new_lock = home / 'new-lock.json'; new_lock.write_bytes(workflow.encoded(new))
                def install(path):
                    (path / 'manifest.json').write_bytes(workflow.encoded(new))
                restore_real = workflow.restore
                with (patch.object(workflow,'download',side_effect=install),
                      patch.object(workflow,'restore',side_effect=lambda source,target:restore_real(source,target,new_lock))):
                    # Successful download followed by failed publication leaves both
                    # the old instance and old bundle usable for a normal retry.
                    with patch.object(workflow,'restore',side_effect=ValueError('publication failed')):
                        with self.assertRaisesRegex(ValueError,'publication failed'):
                            prepare(home,rebuild=True,download=True)
                    self.assertEqual(old,json.loads((assets / 'manifest.json').read_text()))
                    self.assertEqual(first,workflow.check(assets,home / 'instance',lock))
                    updated = prepare(home,rebuild=True,download=True)
                self.assertNotEqual(first['sampleVersion'],updated['sampleVersion'])
                archive = next((home / 'backups').glob('*.tar.gz'))
                restored = restore_snapshot(archive,home / 'old-instance',home / 'old-bundle',lock)
                self.assertEqual(first,restored)

    def test_real_data_guard_applies_to_bundle_and_instance(self):
        with self.assertRaises(ValueError):
            workflow.guard(workflow.ROOT / 'data')
