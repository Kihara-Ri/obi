#!/usr/bin/env python3
"""Repair metadata-only 3D task associations without revalidating stale real evidence."""
import sys, json, sqlite3
from pathlib import Path
from contextlib import closing
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
if not (ROOT/'storage.py').is_file(): ROOT=Path.cwd()
sys.path.insert(0,str(ROOT))
from storage import Store
from twins import TWIN_KEY, same_appearance, appearance

def main(data_dir,backup):
    data=Path(data_dir).resolve()
    dbpath=data/'albums.sqlite3'
    with closing(sqlite3.connect('file:'+str(backup)+'?mode=ro',uri=True)) as old_db:
        old={}
        for (encoded,) in old_db.execute('SELECT data FROM records'):
            row=json.loads(encoded);old[row['id']]=row
        old_raw=old_db.execute('SELECT data FROM meta WHERE key=?',(TWIN_KEY,)).fetchone()
        registry_old=json.loads(old_raw[0]) if old_raw else {'latest':{},'jobs':{}}
    store=Store(dbpath)
    with closing(store.connect()) as db:
        current={r['id']:r for r in store.rows(db,'records')}
        registry=store.meta_get(db,TWIN_KEY) or {'latest':{},'jobs':{}}
        fixes=[]
        for rid,jid in registry_old['latest'].items():
            if rid not in current or rid not in old:continue
            if registry['latest'].get(rid)!=jid:continue
            prev_job=registry_old['jobs'][jid]
            job=registry['jobs'][jid]
            original=old[rid];now=current[rid]
            changed={key for key in set(original)|set(now) if original.get(key)!=now.get(key)}
            if changed-{'version','packaging','legacyPackaging','revision'}:continue
            if not same_appearance(original,prev_job['input']):continue
            if not same_appearance(original,job['input']):continue
            if same_appearance(now,job['input']):continue
            fixes.append((rid,jid))
    print('ELIGIBLE_METADATA_ONLY_REBINDS',len(fixes),flush=True)
    if not fixes:return
    target=data/'backups'/('pre-packaging-twin-rebind-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.sqlite3')
    with closing(sqlite3.connect('file:'+str(dbpath)+'?mode=ro',uri=True)) as source:
        with closing(sqlite3.connect(target)) as dest:
            source.backup(dest)
            if dest.execute('PRAGMA integrity_check').fetchone()[0]!='ok':
                raise RuntimeError('Backup invalid')
    target.chmod(0o600)
    with closing(store.connect()) as db, db:
        db.execute('BEGIN IMMEDIATE')
        nowrec={r['id']:r for r in store.rows(db,'records')}
        latest=store.meta_get(db,TWIN_KEY)
        if latest['revision']!=registry['revision']:raise RuntimeError('Concurrent task change')
        for rid,jid in fixes:
            if nowrec[rid]!=current[rid]:raise RuntimeError('Concurrent record change')
            task=latest['jobs'][jid]
            if not same_appearance(old[rid],task['input']):raise RuntimeError('Task origin changed')
            task['input']=appearance(nowrec[rid])
        store._write_twins(db,latest)
        store.audit(db,'包装描述迁移后恢复数字实体关联',{'count':len(fixes)})
    jobs=store.twin_index()['jobs']
    print('REBOUND',len(fixes),'STILL_STALE',sum(jobs[rid]['status']=='stale' for rid,_ in fixes),flush=True)

if __name__=='__main__':
    main(sys.argv[1],sys.argv[2])
