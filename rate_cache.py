"""Daily quotes and successful query coverage; no network or business-ledger writes."""
import json
import sqlite3
from contextlib import closing
from pathlib import Path


class QuoteCache:
    def __init__(self, path=None):
        self.path = path
        self.values, self.checks = {}, {}
        self.generation = 0
        if path:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            with closing(sqlite3.connect(path)) as db, db:
                db.execute('CREATE TABLE IF NOT EXISTS rates(day TEXT PRIMARY KEY, per100 TEXT)')
                db.execute('CREATE TABLE IF NOT EXISTS rate_checks(day TEXT PRIMARY KEY, data TEXT NOT NULL)')
                self.values.update(db.execute('SELECT day,per100 FROM rates'))
                self.checks.update((d, json.loads(raw)) for d, raw in db.execute('SELECT day,data FROM rate_checks'))

    def save(self, values, checks):
        changed = any(self.values.get(d) != v for d, v in values.items()) or any(
            self.checks.get(d) != v for d, v in checks.items())
        if not changed: return
        if self.path:
            with closing(sqlite3.connect(self.path)) as db, db:
                db.executemany('INSERT OR REPLACE INTO rates VALUES(?,?)', values.items())
                db.executemany('INSERT OR REPLACE INTO rate_checks VALUES(?,?)',
                               [(d, json.dumps(v)) for d, v in checks.items()])
        self.values.update(values)
        self.checks.update(checks)
        self.generation += 1
