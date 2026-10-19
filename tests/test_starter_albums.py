"""新实例起步示例：空库写入两张示例专辑一次；已有数据或已写过则不动。"""
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from rates import RateService  # noqa: E402
from server.starter_albums import STARTER_ALBUMS, seed_starter  # noqa: E402
from storage import Store  # noqa: E402


class StarterAlbumsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        data = Path(self.tmp.name)
        self.store = Store(data / 'albums.sqlite3', RateService(data / 'rates.sqlite3'))

    def tearDown(self):
        self.tmp.cleanup()

    def records(self):
        with self.store.connect() as db:
            return self.store.rows(db, 'records')

    def test_empty_library_gets_two_albums_with_guidance_notes(self):
        self.assertEqual(seed_starter(self.store), 2)
        rs = self.records()
        self.assertEqual(sorted(r['title'] for r in rs), sorted(a['title'] for a in STARTER_ALBUMS))
        for r in rs:
            self.assertEqual(r['status'], 'domestic')
            self.assertTrue(r['note'].startswith('示例'))
            self.assertEqual(r['price'], '')  # 成本未知保持 null 语义，不写 0
            self.assertEqual(r['date'], '')

    def test_runs_only_once(self):
        seed_starter(self.store)
        self.assertEqual(seed_starter(self.store), 0)
        self.assertEqual(len(self.records()), 2)

    def test_deleted_examples_are_not_reinjected(self):
        seed_starter(self.store)
        with self.store.connect() as db:
            db.execute('DELETE FROM records')
        self.assertEqual(seed_starter(self.store), 0)
        self.assertEqual(self.records(), [])

    def test_existing_data_is_left_alone(self):
        self.store.save({'items': [{'title': '已有专辑', 'artist': '某艺人', 'currency': 'CNY'}]})
        self.assertEqual(seed_starter(self.store), 0)
        self.assertEqual([r['title'] for r in self.records()], ['已有专辑'])


if __name__ == '__main__':
    unittest.main()
