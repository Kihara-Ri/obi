"""元数据编辑不能进入汇率模块，也不能改动财务字段；复用固定样本库。"""
from contextlib import closing
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import tempfile
import unittest

from domain import ValidationError
from server import routes
from tools.seed_samples import seed_listing_photos, open_store


class ForbiddenRates:
    def __getattr__(self, name):
        raise AssertionError('metadata save must not call rates.' + name)


class RecordMetadataTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.folder = Path(self.tmp.name)
        self.ids = seed_listing_photos(self.folder)
        self.store = open_store(self.folder)
        self.before = self.store.state()
        self.store.rates = ForbiddenRates()
        self.svc = SimpleNamespace(store=self.store, shops=None, artists=None, releases=None)
        self.h = SimpleNamespace(send=Mock())

    def tearDown(self):
        self.tmp.cleanup()

    def row(self, key):
        with closing(self.store.connect()) as db:
            return self.store.get(db, 'records', self.ids[key])

    def save(self, key='lift-fists', **patch):
        row = self.row(key)
        routes.api_record_metadata(self.h, self.svc,
            {'id': row['id'], 'revision': row['revision'], **patch})
        return self.h.send.call_args.args[0]

    def test_metadata_and_photos_return_canonical_result_without_rates(self):
        old = self.row('lift-fists')
        result = self.save(note='照片与资料编辑', photos=[1, 0])
        saved = self.row('lift-fists')
        self.assertEqual(saved['revision'], old['revision'] + 1)
        self.assertEqual(saved['note'], '照片与资料编辑')
        self.assertEqual(saved['photoCount'], 2)
        self.assertEqual(saved['photoRevision'], old['photoRevision'] + 1)
        self.assertEqual(result['ids'], [saved['id']])
        self.assertEqual(result['records'][0]['photoRevision'], saved['photoRevision'])
        self.assertEqual(result['records'][0]['note'], '照片与资料编辑')
        self.assertEqual(result['audit'][-1]['action'], '修改专辑')
        for key in ('price', 'currency', 'date', 'fees', 'actual', 'location', 'status'):
            self.assertEqual(saved[key], old[key], key)
            self.assertNotIn(key, result['records'][0])
        self.assertNotIn('cost', result['records'][0])
        self.assertNotIn('rate', result['records'][0])
        self.assertNotIn('original', result['records'][0])

    def test_shared_note_returns_both_copies(self):
        result = self.save('dookie-jp', noteAlbum='共享笔记已更新')
        self.assertEqual(len(result['records']), 2)
        self.assertTrue(all(r['noteAlbum'] == '共享笔记已更新' for r in result['records']))
        self.assertEqual({r['title'] for r in result['records']}, {'Dookie'})

    def test_financial_fields_rejected_before_write(self):
        old = self.row('lift-fists')
        for key, value in [('price', '1'), ('fees', '0'), ('date', '2026-10-01'),
                           ('currency', 'CNY'), ('actual', '1'), ('location', 'new')]:
            with self.subTest(key=key), self.assertRaises(ValidationError):
                self.save(**{key: value})
        self.assertEqual(self.row('lift-fists'), old)

    def test_invalid_photos_and_stale_revision_do_not_write(self):
        old = self.row('lift-fists')
        with self.assertRaises(ValidationError):
            self.save(note='不能保存', photos=[99])
        self.assertEqual(self.row('lift-fists'), old)
        with self.assertRaises(ValidationError):
            routes.api_record_metadata(self.h, self.svc,
                {'id': old['id'], 'revision': old['revision'] - 1, 'note': '旧表单'})
        self.assertEqual(self.row('lift-fists'), old)

    def test_metadata_mode_cannot_create_records_or_accept_batches(self):
        for body in ({'title': 'A', 'artist': 'B'}, {'items': []}):
            with self.subTest(body=body), self.assertRaises(ValidationError):
                self.store.save(body, metadata_only=True)
