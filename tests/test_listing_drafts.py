"""旧上架文案的迁移、恢复保护与原图下载。"""
from contextlib import closing
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

from domain import ValidationError
from tools.seed_samples import (LEGACY_LISTING_DESCRIPTION, LEGACY_LISTING_TITLE, open_store,
                                seed_legacy_listing_copy, seed_listing_navigation, seed_listing_photos)


class RetiredListingCopyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.ids = seed_listing_photos(self.tmp.name)
        self.store = open_store(self.tmp.name)
        self.rid = self.ids['lift-fists']

    def tearDown(self):
        self.tmp.cleanup()

    def record(self, store=None):
        store = store or self.store
        with closing(store.connect()) as db:
            return store.get(db, 'records', self.rid)

    def legacy_snapshot(self):
        seed_listing_navigation(self.tmp.name)
        before = self.record()
        seed_legacy_listing_copy(self.tmp.name)
        backup = self.store.backup()
        self.assertEqual(self.record()['listingDescription'], LEGACY_LISTING_DESCRIPTION)
        draft = self.record()['listingDraft']
        self.assertEqual(draft['title'], LEGACY_LISTING_TITLE)
        self.assertIn('listingDescription', backup['audit'][-1]['data'])
        return backup, {**before, 'listingPreparation': {k: v for k, v in draft.items()
                                                         if k not in ('title', 'description')}}

    def assert_clean(self, store, expected):
        self.assertEqual(self.record(store), expected)
        backup = store.backup()
        payload = json.dumps(backup, ensure_ascii=False)
        for text in ('listingDescription', 'listingDraft', LEGACY_LISTING_TITLE, LEGACY_LISTING_DESCRIPTION):
            self.assertNotIn(text, payload)
        self.assertEqual(self.record(store)['listingPreparation']['photoOrder'], [1, 0])
        self.assertNotIn('listingPreparation', next(record for record in store.state()['records']
                                                    if record['id'] == self.rid))

    def test_migration_cleans_records_and_audit_without_writing_other_fields(self):
        before, expected = self.legacy_snapshot()
        migrated = open_store(self.tmp.name)
        self.assert_clean(migrated, expected)
        after = migrated.backup()
        for key in ('sales', 'shipments', 'schema', 'settings'):
            self.assertEqual(after[key], before[key])
        self.assertEqual([(row['id'], row['at'], row['action']) for row in after['audit']],
                         [(row['id'], row['at'], row['action']) for row in before['audit']])
        self.assertNotIn(LEGACY_LISTING_DESCRIPTION.encode(), migrated.path.read_bytes())
        reopened = open_store(self.tmp.name)
        self.assertEqual(after['records'], reopened.backup()['records'])
        self.assertEqual(after['audit'], reopened.backup()['audit'])

    def test_restoring_a_legacy_backup_keeps_metadata_and_discards_copy(self):
        backup, expected = self.legacy_snapshot()
        restored = open_store(Path(self.tmp.name) / 'restored')
        restored.restore_backup(backup)
        self.assert_clean(restored, expected)

    def test_current_record_and_listing_writes_discard_retired_fields(self):
        record = self.record()
        self.store.save({'id': self.rid, 'revision': record['revision'],
                         'listingDescription': LEGACY_LISTING_DESCRIPTION,
                         'listingDraft': {'title': LEGACY_LISTING_TITLE, 'description': LEGACY_LISTING_DESCRIPTION}})
        url = 'https://example.com/item/1'
        self.store.bulk({'ids': [self.rid], 'action': 'list',
                         'listing': {'channel': '示例二手平台', 'url': url,
                                     'description': LEGACY_LISTING_DESCRIPTION}})
        record = self.record()
        self.assertTrue(record['listed'])
        self.assertEqual((record['listingChannel'], record['listingUrl']), ('示例二手平台', url))
        self.assertNotIn('listingDraft', record)
        self.assertNotIn('listingDescription', record)

    def test_zip_file_label_is_safe_and_readable(self):
        from server.listing_photos import file_label
        self.assertEqual(file_label({'artist': 'AC/DC', 'title': 'Back: In "Black"?'}), 'AC DC - Back In Black')
        self.assertEqual(file_label({'artist': '', 'title': '盗作'}), '盗作')
        self.assertEqual(file_label({}), '')
        self.assertLessEqual(len(file_label({'artist': 'a' * 90, 'title': 'b' * 90})), 103)

    def test_zip_uses_selected_order_and_only_this_copy(self):
        from server.listing_photos import photo_archive
        raw = photo_archive(self.store, self.rid, [1, 0], self.record()['photoRevision'])
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            from server.listing_photos import file_label
            label = file_label(self.record())
            self.assertIn(self.record()['title'][:10], label)
            self.assertEqual(archive.namelist(), [f'{label} - 01.png', f'{label} - 02.png'])
            self.assertEqual(archive.read(f'{label} - 01.png'), (self.store.photos_dir / self.rid / '1.png').read_bytes())
        for order in ([], [2], [0, 0]):
            with self.assertRaises(ValidationError):
                photo_archive(self.store, self.rid, order, self.record()['photoRevision'])
        with self.assertRaises(ValidationError):
            photo_archive(self.store, '../outside', [0], 1)

    def test_restore_rejects_malformed_listing_preparation(self):
        backup = self.store.backup()
        backup['records'][0]['listingDraft'] = {'photoOrder': 'bad'}
        with self.assertRaises(ValidationError):
            self.store.restore_backup(backup)
