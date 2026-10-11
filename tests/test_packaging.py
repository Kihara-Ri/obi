import base64
import copy
import tempfile
import unittest
from pathlib import Path

from domain import clean_record, ValidationError
from storage import Store


PHOTO = 'data:image/png;base64,' + base64.b64encode(b'\x89PNGfixture').decode()
LEFT_REGION = [0.03, 0.06, 0.48, 0.04, 0.48, 0.93, 0.04, 0.94]
RIGHT_REGION = [0.52, 0.04, 0.96, 0.06, 0.97, 0.94, 0.52, 0.93]


class PackagingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / 'albums.sqlite3')

    def tearDown(self):
        self.tmp.cleanup()

    def create(self, **values):
        return self.store.save({'title': '独立副本', 'artist': '测试艺人', 'currency': 'CNY',
                                'price': '', 'date': '', **values})['ids'][0]

    def record(self, rid):
        return next(r for r in self.store.state()['records'] if r['id'] == rid)

    def test_independent_copy_metadata_survives_other_edits_and_backup(self):
        a = self.create(version='紙ジャケット', pressing='日版', obi='带侧标', photos=[PHOTO, PHOTO],
                        packaging={'structure': 'gatefold', 'panels': 2, 'miniLP': True,
                                   'finish': 'gloss', 'photos': {'front': 0, 'back': 1}})
        b = self.create(version='Jewel Case', packaging={'structure': 'jewel', 'discs': 2})
        original = self.record(a)
        self.assertIsNone(original['cost'])
        self.store.save({'id': a, 'revision': original['revision'], 'note': '只改笔记'})
        saved = self.record(a)
        self.assertEqual(saved['packaging'], original['packaging'])
        self.assertEqual((saved['version'], saved['pressing'], saved['obi']), ('紙ジャケット', '日版', '带侧标'))
        self.assertEqual(self.record(b)['packaging'], {'structure': 'jewel', 'discs': 2})
        backup = copy.deepcopy(self.store.backup())
        self.store.restore_backup(backup)
        self.assertEqual(self.record(a)['packaging'], saved['packaging'])
        self.assertIsNone(self.record(a)['cost'])

    def test_invalid_package_data_rejects_entire_transaction(self):
        malformed = [{'structure': 'plastic'}, {'panels': True}, {'discs': 0}, {'finish': 'metal'},
                     {'pocketOpening': 'top'}, {'pocketOpening': True},
                     {'miniLP': 'yes'}, {'photos': {'front': True}}, {'photos': {'wrong': 0}},
                     {'size': {'width': 140, 'height': 125}},
                     {'size': {'width': 10 ** 500, 'height': 125, 'depth': 10}},
                     {'size': {'width': 140, 'height': float('nan'), 'depth': 10}}]
        for value in malformed:
            with self.subTest(value=value):
                before = self.store.state()
                with self.assertRaises(ValidationError):
                    self.store.save({'items': [{'title': '不能部分写入', 'artist': 'A'},
                                              {'title': '错误', 'artist': 'A', 'packaging': value}]})
                self.assertEqual(self.store.state(), before)

    def test_inner_and_outer_spines_keep_separate_photo_identity(self):
        rid = self.create(photos=[PHOTO, PHOTO], packaging={'structure': 'gatefold',
                          'photos': {'spine': 0, 'insideSpine': 1},
                          'photoRegions': {'spine': LEFT_REGION, 'insideSpine': RIGHT_REGION}})
        original = self.record(rid)
        self.store.save({'id': rid, 'revision': original['revision'], 'photos': [1, 0]})
        saved = self.record(rid)['packaging']
        self.assertEqual(saved['photos'], {'spine': 1, 'insideSpine': 0})
        self.assertEqual(saved['photoRegions'], original['packaging']['photoRegions'])
        backup = copy.deepcopy(self.store.backup())
        self.store.restore_backup(backup)
        self.assertEqual(self.record(rid)['packaging'], saved)

    def test_missing_photo_is_rejected_before_existing_files_change(self):
        rid = self.create(photos=[PHOTO], packaging={'structure': 'jewel', 'photos': {'front': 0}})
        before = self.record(rid)
        raw = (self.store.photos_dir / rid / '0.png').read_bytes()
        with self.assertRaisesRegex(ValidationError, '不存在'):
            self.store.save({'id': rid, 'revision': before['revision'], 'photos': [0],
                             'packaging': {'structure': 'jewel', 'photos': {'front': 1}}})
        self.assertEqual(self.record(rid), before)
        self.assertEqual((self.store.photos_dir / rid / '0.png').read_bytes(), raw)

    def test_old_client_photo_deletion_and_reorder_preserve_photo_identity(self):
        rid = self.create(photos=[PHOTO, PHOTO, PHOTO],
                          packaging={'structure': 'gatefold', 'photos': {'front': 0, 'back': 1, 'insideRight': 2}})
        self.store.save({'id': rid, 'revision': self.record(rid)['revision'], 'photos': [2, 0]})
        self.assertEqual(self.record(rid)['packaging']['photos'], {'front': 1, 'insideRight': 0})

    def test_explicit_photo_map_addresses_new_order_and_can_be_cleared(self):
        rid = self.create(photos=[PHOTO, PHOTO], packaging={'structure': 'digipak', 'photos': {'front': 0}})
        self.store.save({'id': rid, 'revision': self.record(rid)['revision'], 'photos': [1, 0],
                         'packaging': {'structure': 'digipak', 'photos': {'front': 0, 'disc': 1}}})
        self.assertEqual(self.record(rid)['packaging']['photos'], {'front': 0, 'disc': 1})
        self.store.save({'id': rid, 'revision': self.record(rid)['revision'], 'packaging': None})
        self.assertNotIn('packaging', self.record(rid))

    def test_invalid_backup_photo_map_is_rejected_without_replacing_records(self):
        self.create(photos=[PHOTO], packaging={'structure': 'card-sleeve', 'photos': {'back': 0}})
        before = copy.deepcopy(self.store.backup())
        state_before = self.store.state()
        malformed = copy.deepcopy(before)
        malformed['records'][0]['packaging']['photos']['back'] = 1
        with self.assertRaises(ValidationError): self.store.restore_backup(malformed)
        self.assertEqual(self.store.state(), state_before)

    def test_legacy_records_gain_no_automatic_packaging_profile(self):
        cleaned = clean_record({'title': '原记录', 'artist': '艺人', 'version': '纸盒'})
        self.assertEqual(cleaned['version'], '纸盒')
        self.assertNotIn('packaging', cleaned)
        pending = clean_record({'title': '待核对', 'artist': '艺人', 'version': 'Jewel Case', 'packaging': {'structure': 'unknown'}})
        self.assertEqual(pending['packaging'], {'structure': 'unknown'})
        self.assertEqual(pending['version'], 'Jewel Case')

    def test_multiple_disc_artwork_is_independent(self):
        roles = {'disc': 0, 'disc2': 1, 'disc3': 2, 'disc4': 3}
        rid = self.create(photos=[PHOTO] * 4, packaging={'structure': 'digipak', 'discs': 4, 'photos': roles})
        self.assertEqual(self.record(rid)['packaging']['photos'], roles)
        backup = copy.deepcopy(self.store.backup())
        self.store.restore_backup(backup)
        self.assertEqual(self.record(rid)['packaging']['photos'], roles)

    def test_inner_opening_dual_pocket_original_photo_regions_survive_backup(self):
        packaging = {'structure': 'gatefold', 'panels': 2, 'discs': 2, 'holder': 'pocket',
                     'pockets': 'both', 'pocketOpening': 'inner',
                     'photos': {'insideLeft': 0, 'insideRight': 0},
                     'photoRegions': {'insideLeft': LEFT_REGION, 'insideRight': RIGHT_REGION}}
        rid = self.create(version='Gatefold Sleeve', photos=[PHOTO], packaging=packaging)
        raw = (self.store.photos_dir / rid / '0.png').read_bytes()
        self.assertEqual(self.record(rid)['packaging'], packaging)
        self.assertEqual(self.record(rid)['packaging']['panels'], 2)
        self.store.save({'id': rid, 'revision': self.record(rid)['revision'], 'note': '保留原图'})
        backup = copy.deepcopy(self.store.backup())
        self.store.restore_backup(backup)
        self.assertEqual(self.record(rid)['packaging'], packaging)
        self.assertEqual((self.store.photos_dir / rid / '0.png').read_bytes(), raw)
        self.assertIsNone(self.record(rid)['cost'])

    def test_photo_regions_follow_source_identity_on_old_client_photo_changes(self):
        rid = self.create(photos=[PHOTO] * 3, packaging={
            'structure': 'gatefold', 'photos': {'front': 0, 'insideLeft': 1, 'insideRight': 2},
            'photoRegions': {'front': RIGHT_REGION, 'insideLeft': LEFT_REGION, 'insideRight': RIGHT_REGION}})
        self.store.save({'id': rid, 'revision': self.record(rid)['revision'], 'photos': [2, 0]})
        saved = self.record(rid)['packaging']
        self.assertEqual(saved['photos'], {'front': 1, 'insideRight': 0})
        self.assertEqual(saved['photoRegions'], {'front': RIGHT_REGION, 'insideRight': RIGHT_REGION})
        self.store.save({'id': rid, 'revision': self.record(rid)['revision'], 'photos': []})
        self.assertEqual(self.record(rid)['packaging']['photoRegions'], {})

    def test_cover_region_without_photo_map_is_valid_and_survives_photo_reorder(self):
        rid = self.create(cover=PHOTO, photos=[PHOTO], packaging={
            'photos': {'insideLeft': 0}, 'photoRegions': {'front': LEFT_REGION, 'insideLeft': RIGHT_REGION}})
        self.store.save({'id': rid, 'revision': self.record(rid)['revision'], 'photos': []})
        saved = self.record(rid)
        self.assertTrue(saved['cover'].startswith('/api/cover/'))
        self.assertEqual(saved['packaging']['photos'], {})
        self.assertEqual(saved['packaging']['photoRegions'], {'front': LEFT_REGION})
        self.store.restore_backup(copy.deepcopy(self.store.backup()))
        self.assertEqual(self.record(rid)['packaging'], saved['packaging'])

    def test_invalid_photo_region_rejects_transaction_and_existing_file_changes(self):
        rid = self.create(photos=[PHOTO], packaging={'photoRegions': {'front': LEFT_REGION}})
        before = self.store.state()
        raw = (self.store.photos_dir / rid / '0.png').read_bytes()
        invalid_regions = [None, '0,0,1,0,1,1,0,1', [], [0, 0, 1, 0, 1, 1, 0],
                           [True, 0, 1, 0, 1, 1, 0, 1], [0, 0, float('nan'), 0, 1, 1, 0, 1],
                           [0, 0, float('inf'), 0, 1, 1, 0, 1], [0, 0, 10 ** 500, 0, 1, 1, 0, 1],
                           [-.01, 0, 1, 0, 1, 1, 0, 1], [0, 0, 1.01, 0, 1, 1, 0, 1],
                           [0, 0, 1, 1, 1, 0, 0, 1], [0, 0, 1, 0, .2, .2, 0, 1],
                           [0, 0, .5, 0, 1, 0, 0, 1], [0, 0, 0, 0, 1, 1, 0, 1]]
        for region in invalid_regions:
            with self.subTest(region=region), self.assertRaises(ValidationError):
                self.store.save({'id': rid, 'revision': self.record(rid)['revision'],
                                 'photos': [], 'packaging': {'photoRegions': {'front': region}}})
            self.assertEqual(self.store.state(), before)
            self.assertEqual((self.store.photos_dir / rid / '0.png').read_bytes(), raw)
        for regions in ([], {'unrecognized': LEFT_REGION}):
            with self.subTest(regions=regions), self.assertRaises(ValidationError):
                self.create(packaging={'photoRegions': regions})
            self.assertEqual(self.store.state(), before)

    def test_invalid_backup_photo_region_is_rejected_without_replacing_records(self):
        rid = self.create(packaging={'photoRegions': {'front': LEFT_REGION}})
        before = self.store.state()
        malformed = copy.deepcopy(self.store.backup())
        malformed['records'][0]['packaging']['photoRegions']['front'] = [0, 0, 1, 1, 1, 0, 0, 1]
        with self.assertRaises(ValidationError): self.store.restore_backup(malformed)
        self.assertEqual(self.store.state(), before)
        self.assertEqual(self.record(rid)['packaging']['photoRegions']['front'], LEFT_REGION)


if __name__ == '__main__': unittest.main()
