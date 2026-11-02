"""照片先完整暂存、事务提交后改名切换：失败时账本与照片都保持原样，也不留暂存目录。"""
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


if __name__ == '__main__':
    unittest.main()
