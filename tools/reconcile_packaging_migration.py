#!/usr/bin/env python3
"""Reconcile collateral fields of a packaging migration against its pre-migration snapshot."""
import argparse, json, sqlite3, sys
from collections import Counter
from contextlib import closing
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
if not (ROOT/'storage.py').is_file(): ROOT=Path.cwd()
if not (ROOT/'storage.py').is_file(): raise SystemExit('Run from project root')
sys.path.insert(0,str(ROOT))
from storage import Store

ALLOWED={'version','packaging','legacyPackaging','revision'}

def main(data_dir, backup):
    path=Path(data_dir).resolve()/'albums.sqlite3'
    backup=Path(backup).resolve()
    if not path.is_file() or not backup.is_file() or backup.parent!=(path.parent/'backups'):
        raise SystemExit('Backup and database must exist in the same data directory')
    with closing(sqlite3.connect('file:'+str(backup)+'?mode=ro',uri=True)) as prev:
        old={}
        for (encoded,) in prev.execute('SELECT data FROM records'):
            row=json.loads(encoded)
            old[row['id']]=row
        if prev.execute('PRAGMA integrity_check').fetchone()[0]!='ok':
            raise RuntimeError('Snapshot integrity failure')
    store=Store(path)
    counts=Counter()
    with closing(store.connect()) as db, db:
        db.execute('BEGIN IMMEDIATE')
        live={r['id']:r for r in store.rows(db,'records')}
        if old.keys()!=live.keys(): raise RuntimeError('Record identities changed; aborting all')
        for ident,before in old.items():
            now=live[ident]
            if before==now: continue
            if now.get('revision')!=before.get('revision',0)+1:
                raise RuntimeError('Concurrent edit detected; aborting all')
            if now.get('version')==before.get('version') and now.get('packaging')==before.get('packaging'):
                raise RuntimeError('Unexpected non-packaging changes only; aborting all')
            target=dict(before)
            for field in ALLOWED:
                if field in now: target[field]=now[field]
                else: target.pop(field,None)
            if target!=now:
                store.put(db,'records',target)
                counts['reconciled']+=1
            counts['processed']+=1
        store.audit(db,'包装迁移字段校正',dict(counts))
    with closing(store.connect()) as db:
        after={r['id']:r for r in store.rows(db,'records')}
    # Exact comparison of key presence and value for all non-packaging fields.
    for ident,before in old.items():
        actual=after[ident]
        for k in set(before)|set(actual):
            if k in ALLOWED:continue
            if (k in before)!=(k in actual) or before.get(k)!=actual.get(k):
                raise RuntimeError('A non-packaging field differs after reconciliation')
    print('RECONCILED',dict(counts),'UNRELATED_DIFFERENCES',0,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--data-dir',required=True)
    p.add_argument('--backup',required=True)
    args=p.parse_args()
    main(args.data_dir,args.backup)
