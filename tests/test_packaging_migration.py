"""Dry run, immutable source fields, archive and Store transaction invariants."""
import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path

from storage import Store

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('packaging_migration',ROOT/'tools/migrate_packaging_labels.py')
migration=importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class PackagingMigrationTests(unittest.TestCase):
    def test_dry_run_backup_apply_idempotent_and_keep_other_data(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)
            store=Store(path/'albums.sqlite3')
            ids=store.save({'items': [
                {'title':'A','artist':'Synthetic','version':'纸盒','price':'30',
                 'date':'2026-09-05','currency':'CNY','obi':'带侧标'},
                {'title':'B','artist':'Synthetic','version':'硬壳纸盒','price':'80',
                 'date':'2026-09-05','currency':'CNY'},
                {'title':'C','artist':'Synthetic','version':'纸盒',
                 'packaging':{'structure':'card-sleeve','miniLP':True},
                 'date':'2026-09-05','currency':'CNY'},
                {'title':'D','artist':'Synthetic','version':'Jewel Case','date':'2026-09-05',
                 'currency':'CNY'}]} )['ids']
            before={r['id']:r for r in store.state()['records']}
            self.assertEqual(migration.run(path),4)
            self.assertEqual({r['id']:r for r in store.state()['records']}, before)
            self.assertEqual(migration.run(path,True),4)
            after={r['id']:r for r in store.state()['records']}
            self.assertEqual([after[i]['version'] for i in ids],
                             ['待核对','Rigid Box','Mini LP Sleeve','Jewel Case'])
            self.assertEqual([after[i]['packaging']['structure'] for i in ids],
                             ['unknown','rigid-box','card-sleeve','jewel'])
            self.assertEqual(after[ids[0]]['legacyPackaging'],'纸盒')
            self.assertEqual(after[ids[0]]['obi'],'带侧标')
            for record_id in ids:
                self.assertEqual(after[record_id]['title'], before[record_id]['title'])
                self.assertEqual(after[record_id]['price'], before[record_id]['price'])
                self.assertEqual(after[record_id]['date'], before[record_id]['date'])
            snapshots=list((path/'backups').glob('pre-packaging-*.sqlite3'))
            self.assertEqual(len(snapshots),1)
            with sqlite3.connect(snapshots[0]) as db:
                self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok')
                self.assertEqual(db.execute('SELECT COUNT(*) FROM records').fetchone()[0],4)
            self.assertEqual(migration.run(path),0)

    def test_empty_or_unrecognized_descriptions_unchanged(self):
        for version in ('', '未知制式', 'Jewel Case'):
            record={'version':version,'id':'abc','revision':1}
            patch=migration.plan_record(record)
            if version=='Jewel Case':
                self.assertEqual(patch['version'],'Jewel Case')
            else:self.assertIsNone(patch)
