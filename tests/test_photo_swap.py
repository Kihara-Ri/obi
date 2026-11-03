"""照片先完整暂存、切换日志随事务提交、提交后改名切换：失败时账本与照片都保持原样；提交后进程退出，下次启动补完。"""
import base64
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from storage import Store

A, B, C = (b'\x89PNG\r\n\x1a\n' + bytes([n]) * 16 for n in (1, 2, 3))
url = lambda raw: 'data:image/png;base64,' + base64.b64encode(raw).decode()


class PhotoSwapTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.folder = Path(self.tmp.name)
        self.store = Store(self.folder / 'db.sqlite3')
        self.rid = self.store.save({'title': 'T', 'artist': 'A', 'photos': [url(A), url(B)]})['ids'][0]

    def tearDown(self): self.tmp.cleanup()

    def row(self):
        with closing(self.store.connect()) as db:
            return self.store.get(db, 'records', self.rid)

    def files(self):
        return {p.name: p.read_bytes() for p in (self.store.photos_dir / self.rid).iterdir()}

    def leftovers(self):
        root = self.folder / '.photo-swap'
        return sorted(p.name for p in root.iterdir()) if root.exists() else []

    def test_failed_commit_keeps_photos_and_ledger(self):
        before, files = self.row(), self.files()
        catalog = self.store._album_catalog
        self.store._album_catalog = lambda db: (_ for _ in ()).throw(RuntimeError('disk full'))
        try:
            with self.assertRaises(RuntimeError):
                self.store.save({'id': self.rid, 'revision': before['revision'], 'photos': [1, url(C)]})
        finally:
            self.store._album_catalog = catalog
        self.assertEqual(self.row(), before)
        self.assertEqual(self.files(), files)
        self.assertEqual(self.leftovers(), [])

    def test_reorder_and_add_keep_every_photo_and_clean_up(self):
        self.store.save({'id': self.rid, 'revision': self.row()['revision'], 'photos': [1, 0, url(C)]})
        self.assertEqual(self.files(), {'0.png': B, '1.png': A, '2.png': C})
        self.assertEqual(self.row()['photoCount'], 3)
        self.store.save({'id': self.rid, 'revision': self.row()['revision'], 'photos': []})
        self.assertFalse((self.store.photos_dir / self.rid).exists())
        self.assertEqual(self.leftovers(), [])

    def journal(self):
        with closing(self.store.connect()) as db:
            return [r[0] for r in db.execute("SELECT key FROM meta WHERE key LIKE 'photo-swap:%'")]

    def save_then_crash(self, after_first_rename=False):
        """提交后、改名前（或两次改名之间）进程退出：用 no-op 代替提交后的切换。"""
        finish = self.store.finish_photo_swaps
        self.store.finish_photo_swaps = lambda keys=None: None
        try:
            self.store.save({'id': self.rid, 'revision': self.row()['revision'], 'photos': [1, url(C)]})
        finally:
            self.store.finish_photo_swaps = finish
        [key] = self.journal()
        if after_first_rename:
            staged = self.folder / '.photo-swap' / key.split(':', 1)[1]
            (self.store.photos_dir / self.rid).rename(staged.with_name(staged.name + '.old'))

    def test_normal_save_leaves_no_journal(self):
        self.store.save({'id': self.rid, 'revision': self.row()['revision'], 'photos': [1, url(C)]})
        self.assertEqual(self.journal(), [])

    def test_crash_after_commit_is_rolled_forward_on_next_start(self):
        self.save_then_crash()
        self.assertEqual(self.files(), {'0.png': A, '1.png': B})   # 账本已是新照片，磁盘还是旧的
        self.store = Store(self.folder / 'db.sqlite3')
        self.assertEqual(self.files(), {'0.png': B, '1.png': C})
        self.assertEqual(self.row()['photoCount'], 2)
        self.assertEqual((self.journal(), self.leftovers()), ([], []))

    def test_crash_between_renames_is_rolled_forward_on_next_start(self):
        self.save_then_crash(after_first_rename=True)
        self.assertFalse((self.store.photos_dir / self.rid).exists())
        self.store = Store(self.folder / 'db.sqlite3')
        self.assertEqual(self.files(), {'0.png': B, '1.png': C})
        self.assertEqual((self.journal(), self.leftovers()), ([], []))


if __name__ == '__main__':
    unittest.main()
