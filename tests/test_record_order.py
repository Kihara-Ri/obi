"""固定样本的同日顺序：保存、流转、重启与备份恢复都不移动既有副本。"""
import tempfile
import unittest
from pathlib import Path

from tools.seed_samples import seed, open_store


class RecordOrderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.ids = seed(self.root / 'source')
        self.store = open_store(self.root / 'source')

    def order(self, store=None):
        return [r['id'] for r in (store or self.store).state()['records']]

    def record(self, key):
        return next(r for r in self.store.state()['records'] if r['id'] == self.ids[key])

    def test_edit_and_full_refresh_preserve_order_and_creation_time(self):
        before = self.order()
        for key in ('dookie-jp', 'parachutes'):
            record = self.record(key)
            self.store.save({'id': record['id'], 'revision': record['revision'],
                             'note': '同日排序回归'}, metadata_only=True)
            self.assertEqual(self.order(), before)
            self.assertEqual(self.record(key)['createdAt'], record['createdAt'])
        record = self.record('dookie-jp')
        self.store.save({'id': record['id'], 'revision': record['revision'], 'location': '示例渠道'})
        self.assertEqual(self.order(), before)
        self.assertEqual(self.order(open_store(self.root / 'source')), before)

    def test_listing_restore_and_new_copy_do_not_reorder_existing_copies(self):
        before = self.order()
        for action in ('list', 'unlist', 'delete', 'restore'):
            self.store.bulk({'ids': [self.ids['dookie-jp']], 'action': action})
            self.assertEqual(self.order(), before, action)
        record = self.record('dookie-jp')
        for key in ('id', 'revision', 'createdAt', 'cost', 'photoCount'):
            record.pop(key, None)
        new_id = self.store.save(record)['ids'][0]
        self.assertEqual(self.order(), before + [new_id])
        backup = self.store.backup()
        restored = open_store(self.root / 'restored')
        restored.restore_backup(backup)
        self.assertEqual(self.order(restored), before + [new_id])
        edited = next(r for r in restored.state()['records'] if r['id'] == before[0])
        restored.save({'id': edited['id'], 'revision': edited['revision'], 'note': '恢复后编辑'})
        self.assertEqual(self.order(restored), before + [new_id])


if __name__ == '__main__':
    unittest.main()
