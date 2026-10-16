#!/usr/bin/env python3
"""Idempotent packaging standardization via Store.save's single transaction.

Never run against an unknown path. --apply takes a verified SQLite online snapshot
before updating; original text is preserved in legacyPackaging, and unclear paper
structures remain explicitly unknown rather than being assigned an invented sleeve.
The archival SQLite snapshot is separate from the app's JSON backup rotation.
"""
import argparse
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
if not (ROOT / 'storage.py').is_file(): ROOT = Path.cwd()
if not (ROOT / 'storage.py').is_file(): raise SystemExit('从项目根目录运行迁移工具')
sys.path.insert(0, str(ROOT))
from storage import Store

CANONICAL = {
    'Jewel Case': ('Jewel Case', 'jewel'),
    'Digipak': ('Digipak', 'digipak'),
    'Card Sleeve': ('Card Sleeve', 'card-sleeve'),
    'Gatefold Sleeve': ('Gatefold Sleeve', 'gatefold'),
    'Digisleeve': ('Digisleeve', 'gatefold'),
    'Digibook': ('Digibook', 'digibook'),
    'Rigid Box': ('Rigid Box', 'rigid-box'),
    'Mini LP Sleeve': ('Mini LP Sleeve', 'card-sleeve'),
    'Slimline Jewel Case': ('Slimline Jewel Case', 'jewel'),
    'Multi-CD Jewel Case': ('Multi-CD Jewel Case', 'jewel'),
    '纸盒': ('待核对', 'unknown'),
    '硬壳纸盒': ('Rigid Box', 'rigid-box'),
    '塑料盒': ('Jewel Case', 'jewel'),
    '透明盒': ('Jewel Case', 'jewel'),
    '纸套': ('Card Sleeve', 'card-sleeve'),
    '对折纸套': ('Gatefold Sleeve', 'gatefold'),
}
STRUCTURE_NAMES = {
    'jewel':'Jewel Case', 'card-sleeve':'Card Sleeve',
    'gatefold':'Gatefold Sleeve', 'digipak':'Digipak',
    'digibook':'Digibook', 'rigid-box':'Rigid Box', 'unknown':'待核对',
}
def plan_record(record):
    original = str(record.get('version') or '').strip()
    info = record.get('packaging') or {}
    if not original:
        return None
    canonical = CANONICAL.get(original)
    if not canonical:
        if original in STRUCTURE_NAMES.values(): return None
        # Unrecognized strings are deliberately not erased.
        return None
    name, structure = canonical
    if info.get('structure') and info['structure'] != 'unknown':
        structure = info['structure']
        name = STRUCTURE_NAMES.get(structure, name)
        if info.get('miniLP') and structure == 'card-sleeve': name = 'Mini LP Sleeve'
        if structure == 'jewel' and info.get('thickness') == 'slim': name = 'Slimline Jewel Case'
        if structure == 'jewel' and info.get('thickness') == 'thick': name = 'Multi-CD Jewel Case'
    spec = dict(info)
    if not spec.get('structure'): spec['structure'] = structure
    if name == 'Mini LP Sleeve' and structure == 'card-sleeve': spec['miniLP'] = True
    if name == 'Slimline Jewel Case' and structure == 'jewel': spec['thickness'] = 'slim'
    if name == 'Multi-CD Jewel Case' and structure == 'jewel': spec['thickness'] = 'thick'
    if name == original and spec == info: return None
    patch = {'id':record['id'], 'revision':record['revision'], 'version':name, 'packaging':spec}
    if original != name and not record.get('legacyPackaging'): patch['legacyPackaging'] = original
    return patch

def inspect(store):
    records = store.state()['records']
    patches = [x for r in records if (x := plan_record(r))]
    before = Counter(r.get('version','') for r in records)
    after = Counter({})
    lookup = {x['id']:x['version'] for x in patches}
    for r in records: after[lookup.get(r['id'], r.get('version',''))] += 1
    return records, patches, before, after

def snapshot(path):
    backup_dir = path.parent/'backups'
    backup_dir.mkdir(parents=True,exist_ok=True)
    target = backup_dir / ('pre-packaging-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.sqlite3')
    with closing(sqlite3.connect('file:' + str(path) + '?mode=ro', uri=True)) as source:
        with closing(sqlite3.connect(target)) as dest:
            source.backup(dest)
            assert dest.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
            assert dest.execute('SELECT COUNT(*) FROM records').fetchone()[0] == source.execute('SELECT COUNT(*) FROM records').fetchone()[0]
    target.chmod(0o600)
    return target

def run(data_dir, apply=False):
    path = (Path(data_dir).resolve() / 'albums.sqlite3')
    if not path.is_file(): raise SystemExit('目标 SQLite 不存在，拒绝创建新数据库')
    store = Store(path)
    records, patches, before, after = inspect(store)
    print('RECORDS',len(records),'PATCHES',len(patches),'BEFORE',dict(before),'AFTER',dict(after),flush=True)
    if not apply: return len(patches)
    archive = snapshot(path)
    print('BACKUP',archive,'BYTES',archive.stat().st_size,flush=True)
    if patches:
        # Use Store.put inside one SQLite transaction. Store.save fills missing
        # optional keys on older rows, which would mutate unrelated metadata.
        from domain import clean_packaging
        with closing(store.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE')
            for patch in patches:
                row = store.get(db, 'records', patch['id'])
                if row['revision'] != patch['revision']:
                    raise RuntimeError('Concurrent edit detected; transaction aborted')
                for field in ('version', 'packaging', 'legacyPackaging'):
                    if field in patch: row[field] = patch[field]
                row['packaging'] = clean_packaging(row['packaging'])
                row['revision'] += 1
                store.put(db, 'records', row)
            store.audit(db, '包装描述标准化', {'count':len(patches)})
    next_records, remaining, actual_before, _ = inspect(store)
    assert not remaining, 'Migration did not converge'
    assert len(next_records) == len(records),'Record count changed'
    assert actual_before == after, 'Final distribution differs'
    print('APPLIED',len(patches),'VERIFIED',len(next_records), 'REMAINING',len(remaining),flush=True)
    return len(patches)

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--data-dir',required=True)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    run(args.data_dir,args.apply)
