"""Fixed sample archives survive interruption at every directory rename boundary."""
import io
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from server import archive, local_entry
from tools.seed_samples import open_store, seed_listing_photos


class ArchiveRecoveryTests(unittest.TestCase):
    def test_every_rename_boundary_can_resume(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            seed_listing_photos(root / 'source')
            source = open_store(root / 'source')
            payload = archive.build(source)
            expected = {p.relative_to(source.photos_dir): p.read_bytes()
                        for p in source.photos_dir.rglob('*') if p.is_file()}
            # Four existing folders: two renames each, then previous: one.
            for after in (False, True):
                for stop in range(1, 10):
                    with self.subTest(after=after, stop=stop):
                        target = root / f'{after}-{stop}'
                        seed_listing_photos(target)
                        store = open_store(target)
                        for name in archive.FOLDERS: (target / name).mkdir(exist_ok=True)
                        before = {p.relative_to(store.photos_dir): p.read_bytes()
                                  for p in store.photos_dir.rglob('*') if p.is_file()}
                        original = Path.rename
                        count = 0
                        def interrupted(path, dest):
                            nonlocal count
                            count += 1
                            if count == stop and not after: raise OSError('interrupted')
                            result = original(path, dest)
                            if count == stop and after: raise OSError('interrupted')
                            return result
                        with patch.object(Path, 'rename', interrupted):
                            with self.assertRaises(OSError):
                                archive.restore(store, io.BytesIO(payload))
                        self.assertTrue(list(target.glob('.archive-restore-*')))
                        recovered = open_store(target)
                        recovered.finish_archive_restore()  # also idempotent in-process
                        actual = {p.relative_to(recovered.photos_dir): p.read_bytes()
                                  for p in recovered.photos_dir.rglob('*') if p.is_file()}
                        self.assertEqual(actual, expected)
                        old = target / 'backups/pre-restore/photos'
                        self.assertEqual({p.relative_to(old): p.read_bytes()
                                          for p in old.rglob('*') if p.is_file()}, before)
                        self.assertFalse(list(target.glob('.archive-restore-*')))
                        with closing(recovered.connect()) as db:
                            self.assertIsNone(recovered.meta_get(db, 'archive-restore-v1'))

    def test_import_does_not_trust_recovery_instructions(self):
        with tempfile.TemporaryDirectory() as folder:
            seed_listing_photos(folder)
            store = open_store(folder)
            backup = store.backup()
            backup['settings']['archive-restore-v1'] = '../outside'
            backup['settings']['photo-swap:injected'] = 'outside'
            store.restore_backup(backup)
            self.assertNotIn('archive-restore-v1', store.backup()['settings'])
            self.assertNotIn('photo-swap:injected', store.backup()['settings'])

    def test_next_local_request_finishes_a_committed_restore(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            seed_listing_photos(root / 'source')
            payload = archive.build(open_store(root / 'source'))
            engine = local_entry.Engine(root / 'target', seed=False)
            store = engine.svc.store
            with patch.object(store, 'finish_archive_restore', side_effect=[None, OSError('interrupted')]):
                with self.assertRaises(OSError): archive.restore(store, io.BytesIO(payload))
            self.assertTrue(list((root / 'target').glob('.archive-restore-*')))
            status, _, _ = engine.handle('GET', '/api/health', '{}', b'')
            self.assertEqual(status, 200)
            self.assertFalse(list((root / 'target').glob('.archive-restore-*')))
            self.assertEqual(len(list(store.photos_dir.rglob('*.png'))), 2)

    def test_transaction_failure_keeps_old_ledger_and_cleans_stage(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            seed_listing_photos(root / 'source')
            seed_listing_photos(root / 'target')
            store = open_store(root / 'target')
            before = store.backup()['records']
            payload = archive.build(open_store(root / 'source'))
            with patch.object(store, 'audit', side_effect=OSError('transaction interrupted')):
                with self.assertRaises(OSError): archive.restore(store, io.BytesIO(payload))
            self.assertEqual(store.backup()['records'], before)
            self.assertFalse(list((root / 'target').glob('.archive-restore-*')))
            self.assertEqual(len(list(store.photos_dir.rglob('*.png'))), 2)
