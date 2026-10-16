#!/usr/bin/env python3
"""Audit per-copy published 3D status before/after a metadata-only migration."""
from pathlib import Path
from contextlib import closing
import sqlite3, json, sys
root=Path.cwd()
sys.path.insert(0,str(root))
from storage import Store
from twins import TWIN_KEY, appearance, same_appearance

path=Path(sys.argv[1]); backup=Path(sys.argv[2])
store=Store(path)
with closing(sqlite3.connect(backup)) as before:
    old={}
    for (text,) in before.execute("SELECT data FROM records"):
        row=json.loads(text); old[row['id']]=row
    row=before.execute("SELECT data FROM meta WHERE key=?",(TWIN_KEY,)).fetchone()
    registry=json.loads(row[0]) if row else None
with closing(store.connect()) as db:
    curr={r['id']:r for r in store.rows(db,'records')}
    live=store.meta_get(db,TWIN_KEY)
print('REGISTRY_OLD',len(registry['jobs']) if registry else 0,'REGISTRY_NEW',len(live['jobs']) if live else 0)
for rid,jid in (registry['latest'] if registry else {}).items():
    item=registry['jobs'][jid]
    now=live['jobs'].get(jid) if live else None
    if not now:continue
    previous_status=store._public_twin(item,old[rid])['status']
    current_status=store._public_twin(now,curr[rid])['status']
    allowed={'version','packaging','legacyPackaging','revision'}
    diff={k for k in set(old[rid])|set(curr[rid]) if old[rid].get(k)!=curr[rid].get(k)}
    print('JOB',previous_status,current_status,'SNAPSHOT_COMPATIBLE',same_appearance(old[rid],item['input']),'METADATA_ONLY',diff<=allowed,'DIFF_FIELDS',','.join(sorted(diff)))
