"""/api/state 的 ETag 与增量下发：拼回来的状态必须与整份下发逐字段相同。

apply_delta 是 web/src/core/state-sync.ts 里 applyStateDelta 的逐行对照；改了一边要同步另一边
（前端同一组用例见 web/tests/state-sync.test.mjs）。
"""
import gzip
import http.client
import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

from covers import CoverService
from rates import RateService
from server import Services, make_handler, state_sync
from storage import Store, STATE_SETTINGS
from tests.test_ledger import FakeRates


def apply_table(base, d):
    changed = {row['id'] for row in d['put']}
    dropped = set(d['drop'])
    rows = [row for row in base if row['id'] not in changed and row['id'] not in dropped] + d['put']
    if 'order' not in d: return rows
    by_id = {row['id']: row for row in rows}
    return [by_id[ident] for ident in d['order']]


def apply_delta(base, delta):
    out = {k: v for k, v in delta.items() if k != 'delta' and k not in state_sync.TABLES}
    for t in state_sync.TABLES: out[t] = apply_table(base[t], delta[t])
    return out


class Exchange:
    """最小的请求替身：只记录 send / not_modified 的结果。"""
    def __init__(self, etag=''):
        self.headers = {'If-None-Match': etag} if etag else {}
        self.status = self.body = self.etag = None

    def send(self, data, status=200, etag=None, headers=None, **_):
        self.status, self.body = status, json.loads(data)
        self.etag = etag or (headers or {}).get('ETag')

    def not_modified(self, etag, cache='no-store'):
        self.status, self.etag = 304, etag


class StateSyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / 'db.sqlite3', FakeRates({'2026-09-07': '4.8'}))
        state_sync._snapshots.clear()
        self.client = None   # (etag, state)：前端当前持有的那份

    def tearDown(self): self.tmp.cleanup()

    def buy(self, title, **kw):
        return self.store.save({'title': title, 'artist': '艺人', 'date': '2026-09-07', 'price': '2000',
                                'currency': 'JPY', 'fees': '10', **kw})['ids'][0]

    def revision(self, rid):
        return next(r for r in self.store.state()['records'] if r['id'] == rid)['revision']

    def pull(self):
        """模拟前端 refresh：带上次的 ETag，304 保持原状，增量拼回，整份直接替换。"""
        h = Exchange(self.client[0] if self.client else '')
        state_sync.send_state(h, self.store.state())
        if h.status == 304: return 'same'
        if 'delta' in h.body:
            self.assertEqual(h.body['delta'], self.client[0])
            self.client = (h.etag, apply_delta(self.client[1], h.body))
            kind = 'delta'
        else:
            self.client = (h.etag, h.body)
            kind = 'full'
        self.assertEqual(self.client[1], self.store.state())   # 与整份下发逐字段相同（含行序）
        return kind

    def test_unchanged_state_is_not_modified(self):
        self.buy('A')
        self.assertEqual(self.pull(), 'full')
        self.assertEqual(self.pull(), 'same')

    def test_edits_arrive_as_deltas_that_rebuild_the_full_state(self):
        a, b, c = self.buy('A'), self.buy('B'), self.buy('C')
        self.assertEqual(self.pull(), 'full')
        self.store.save({'id': b, 'revision': self.revision(b), 'note': '改了备注'})   # INSERT OR REPLACE 换 rowid
        self.assertEqual(self.pull(), 'delta')
        self.store.bulk({'action': 'delete', 'ids': [a, c]})
        self.assertEqual(self.pull(), 'delta')
        self.buy('D')
        self.store.sell({'ids': [b], 'gross': '160', 'fees': '10', 'date': '2026-09-07'})
        self.assertEqual(self.pull(), 'delta')

    def test_delta_carries_only_changed_rows(self):
        ids = [self.buy(f'专辑{i}') for i in range(5)]
        self.pull()
        self.store.save({'id': ids[2], 'revision': self.revision(ids[2]), 'note': 'x'})
        h = Exchange(self.client[0])
        state_sync.send_state(h, self.store.state())
        self.assertEqual([r['id'] for r in h.body['records']['put']], [ids[2]])
        self.assertEqual(h.body['records']['drop'], [])
        self.assertEqual(h.body['sales'], {'put': [], 'drop': []})

    def test_audit_window_slides_with_drops(self):
        ids = [self.buy(f'专辑{i}') for i in range(60)]
        self.pull()
        for rid in ids: self.store.bulk({'action': 'delete', 'ids': [rid]})   # 再写 60 条 audit，窗口只留 100 条
        self.assertEqual(self.pull(), 'delta')
        self.assertEqual(len(self.client[1]['audit']), 100)

    def test_restore_replacing_everything_still_rebuilds(self):
        self.buy('A'); self.buy('B')
        backup = self.store.backup()
        self.pull()
        self.buy('C')
        self.pull()
        self.store.restore_backup(backup)
        self.assertIn(self.pull(), ('delta', 'full'))

    def test_unknown_base_gets_the_full_state(self):
        self.buy('A')
        self.client = ('"stale"', {})
        self.assertEqual(self.pull(), 'full')

    def test_state_only_carries_whitelisted_settings(self):
        self.buy('A')
        settings = self.store.backup()['settings']
        self.assertTrue(set(settings) - set(STATE_SETTINGS))   # 库里确有不下发的 meta
        state = self.store.state()
        self.assertLessEqual(set(state['settings']), set(STATE_SETTINGS))
        self.assertNotIn('createdAt', state)

    def test_reordered_rows_carry_the_full_order(self):
        before = [('a', b'1'), ('b', b'2'), ('c', b'3')]
        after = [('c', b'3'), ('a', b'1'), ('b', b'2')]
        rows = [{'id': 'c'}, {'id': 'a'}, {'id': 'b'}]
        d = state_sync._table_delta(before, after, rows)
        self.assertEqual(d, {'put': [], 'drop': [], 'order': ['c', 'a', 'b']})
        self.assertEqual(apply_table([{'id': 'a'}, {'id': 'b'}, {'id': 'c'}], d), rows)


class StateHttpTests(unittest.TestCase):
    """走真实的请求管线：304 无响应体；增量与整份共用 ETag 时，gzip 记忆不会把一种当成另一种发出去。"""
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); root = Path(self.tmp.name)
        self.store = Store(root / 'albums.sqlite3')
        services = Services(store=self.store, covers=CoverService(root / 'covers.sqlite3'),
                            rates=RateService(root / 'rates.sqlite3'))
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(services))
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        state_sync._snapshots.clear()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.tmp.cleanup()

    def get(self, etag=''):
        c = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        headers = {'Accept-Encoding': 'gzip', **({'If-None-Match': etag} if etag else {})}
        c.request('GET', '/api/state', headers=headers); r = c.getresponse()
        status, head, raw = r.status, dict(r.getheaders()), r.read(); c.close()
        body = json.loads(gzip.decompress(raw) if head.get('Content-Encoding') == 'gzip' else raw) if raw else None
        return status, head, body

    def test_conditional_and_delta_responses(self):
        for i in range(30): self.store.save({'title': f'专辑{i}', 'artist': '艺人', 'date': '2026-09-07'})
        status, head, first = self.get()
        self.assertEqual((status, head['Cache-Control']), (200, 'no-store'))
        status, head, body = self.get(head['ETag'])
        self.assertEqual((status, body), (304, None))
        self.store.save({'title': '新的一张', 'artist': '艺人', 'date': '2026-09-08'})
        status, head, delta = self.get(head['ETag'])
        self.assertEqual(status, 200)
        self.assertEqual(len(delta['records']['put']), 1)
        status, full_head, full = self.get()
        self.assertNotIn('delta', full)
        self.assertEqual(full_head['ETag'], head['ETag'])
        self.assertEqual(apply_delta(first, delta), full)


if __name__ == '__main__':
    unittest.main()
