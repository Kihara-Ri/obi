"""保存专辑时发行版核对要联网：只有落库那一步持有写锁，核对期间其他写请求不被堵住。"""
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from server import routes
from storage import Store


class RecordWriteLockTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / 'db.sqlite3')

    def tearDown(self): self.tmp.cleanup()

    def test_catalog_check_runs_outside_the_lock_and_save_inside(self):
        seen = []
        verify = lambda svc, barcode, edition: seen.append(('verify', routes.WRITE_LOCK.locked()))
        save = self.store.save
        def locked_save(body, **kw):
            seen.append(('save', routes.WRITE_LOCK.locked()))
            return save(body, **kw)
        self.store.save = locked_save
        svc = SimpleNamespace(store=self.store, shops=None, artists=None)
        with patch('server.routes.verify_barcode_release', verify):
            routes.api_records(SimpleNamespace(send=Mock()), svc, {
                'title': 'T', 'artist': 'A',
                'releaseInfo': {'barcode': '4988005123456', 'musicBrainzReleaseId': '0' * 8 + '-0000-0000-0000-' + '0' * 12}})
        self.assertEqual(seen, [('verify', False), ('save', True)])
        self.assertEqual(routes.POST['/api/records'][2], False)
        self.assertEqual(routes.POST['/api/records/metadata'][2], False)


if __name__ == '__main__':
    unittest.main()
