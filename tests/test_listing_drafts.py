"""售卖草稿的事务、照片归属、恢复边界；只使用固定样本与临时目录。"""
import copy
import io
import tempfile
import unittest
import zipfile

from domain import ValidationError
from tools.seed_samples import seed_listing_photos, open_store


class ListingDraftTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.ids = seed_listing_photos(self.tmp.name)
        self.store = open_store(self.tmp.name)
        self.rid = self.ids['lift-fists']

    def tearDown(self):
        self.tmp.cleanup()

    def record(self, rid=None):
        with self.store.connect() as db:
            return self.store.get(db, 'records', rid or self.rid)

    def payload(self):
        r = self.record()
        return {'id': self.rid, 'revision': r['revision'], 'draft': {
            'title': '售卖标题', 'description': '已确认的描述', 'versionText': '',
            'conditionText': '盒面擦痕', 'versionConfirmed': False, 'conditionConfirmed': True,
            'photoRevision': r['photoRevision'], 'photoOrder': [1, 0]}}

    def test_save_preserves_stock_money_and_siblings_and_restores(self):
        before = self.record()
        self.store.save_listing_draft(self.payload())
        after = self.record()
        self.assertEqual(after.get('listed'), before.get('listed'))
        for key in ('status', 'price', 'fees', 'location', 'releaseInfo'):
            self.assertEqual(after.get(key), before.get(key))
        self.assertEqual(after['listingDescription'], '已确认的描述')
        self.assertEqual(after['listingDraft']['photoOrder'], [1, 0])
        self.assertNotIn('listingDraft', self.record(self.ids['illinois']))
        backup = self.store.backup()
        self.store.restore_backup(copy.deepcopy(backup))
        self.assertEqual(self.record()['listingDraft'], after['listingDraft'])

    def test_stale_record_or_photos_rejected_without_writes(self):
        payload = self.payload()
        self.store.save_listing_draft(payload)
        before = self.store.backup()
        with self.assertRaises(ValidationError):
            self.store.save_listing_draft(payload)
        payload = self.payload()
        payload['draft']['photoRevision'] += 1
        with self.assertRaises(ValidationError):
            self.store.save_listing_draft(payload)
        self.assertEqual(self.store.backup()['records'], before['records'])

    def test_reject_invalid_selection_and_disabled_trading(self):
        for order in ([0, 0], [-1], [2], [True], ['0']):
            payload = self.payload(); payload['draft']['photoOrder'] = order
            with self.subTest(order=order), self.assertRaises(ValidationError):
                self.store.save_listing_draft(payload)
        self.store.set_modules(dict(acquisition=True, trading=False, circulation=True, showcase=True))
        with self.assertRaises(ValidationError):
            self.store.save_listing_draft(self.payload())

    def test_zip_uses_selected_order_and_only_this_copy(self):
        from server.listing_photos import photo_archive
        raw = photo_archive(self.store, self.rid, [1, 0], self.record()['photoRevision'])
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            self.assertEqual(archive.namelist(), ['01.png', '02.png'])
            self.assertEqual(archive.read('01.png'), (self.store.photos_dir / self.rid / '1.png').read_bytes())
        for order in ([], [2], [0, 0]):
            with self.assertRaises(ValidationError):
                photo_archive(self.store, self.rid, order, self.record()['photoRevision'])
        with self.assertRaises(ValidationError):
            photo_archive(self.store, '../outside', [0], 1)

    def test_restore_rejects_malformed_draft(self):
        backup = self.store.backup()
        backup['records'][0]['listingDraft'] = {'photoOrder': 'bad'}
        with self.assertRaises(ValidationError):
            self.store.restore_backup(backup)

    def test_record_editor_cannot_bypass_draft_module_or_revision_contract(self):
        self.store.save_listing_draft(self.payload())
        before = self.record()['listingDraft']
        r = self.record()
        self.store.save({'id': self.rid, 'revision': r['revision'], 'listingDraft': {
            **before, 'description': '不能从编辑入口绕过'}})
        self.assertEqual(self.record()['listingDraft'], before)

    def test_mark_listing_and_draft_are_one_atomic_transaction(self):
        payload = {**self.payload(), 'markListed': True, 'listing': {'channel': '闲鱼', 'url': 'bad-url'}}
        before = self.record()
        with self.assertRaises(ValidationError): self.store.save_listing_draft(payload)
        self.assertEqual(self.record(), before)
        payload['listing']['url'] = 'https://example.com/item/1'
        self.store.save_listing_draft(payload)
        record = self.record()
        self.assertTrue(record['listed'])
        self.assertEqual(record['revision'], before['revision'] + 1)
        self.assertEqual(record['listingUrl'], 'https://example.com/item/1')
