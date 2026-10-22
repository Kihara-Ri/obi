"""/api/state 的条件请求与增量下发。

- ETag 是响应体的内容哈希：客户端带着同一个 ETag 来就回 304，前端不重渲染。
- 客户端的旧 ETag 还在快照缓存里时，只回变化的行（put）与消失的行（drop），
  其余字段照常整份给；前端 web/src/core/state-sync.ts 的 applyStateDelta 拼回完整状态。
  两边的拼法一一对应（见 _table_delta），拼出的结果与整份下发逐字段相同（tests/test_state_sync.py）。
- 缓存只存每行的摘要，不存内容；进程重启或基线太旧就整份下发，前端无感。
"""
import hashlib
import json
import threading
from collections import OrderedDict

TABLES = ('records', 'sales', 'shipments', 'audit')
KEEP = 8   # 记住最近几份状态：多设备、多标签页各自停在不同的旧版本

_lock = threading.Lock()
_snapshots = OrderedDict()   # ETag → {表名: [(行 id, 摘要), …]}，按现在的行序


def _dumps(value):
    return json.dumps(value, ensure_ascii=False)


def _index(state):
    return {t: [(row['id'], hashlib.sha256(_dumps(row).encode()).digest()[:16]) for row in state[t]]
            for t in TABLES}


def _table_delta(before, after, rows):
    """before / after：基线与现在的 [(id, 摘要)]；rows：现在的整张表。

    前端拼法：基线里没变也没消失的行保持原顺序，put 按现在的顺序接在后面。
    拼出来的顺序和现在不同（如 INSERT OR REPLACE 换了 rowid）时，附上完整的 order。
    """
    old = dict(before)
    put = [row for row, (ident, digest) in zip(rows, after) if old.get(ident) != digest]
    changed = {row['id'] for row in put}
    current = [ident for ident, _ in after]
    alive = set(current)
    out = {'put': put, 'drop': [ident for ident, _ in before if ident not in alive]}
    rebuilt = [ident for ident, _ in before if ident in alive and ident not in changed] + [row['id'] for row in put]
    if rebuilt != current: out['order'] = current
    return out


def send_state(h, state):
    body = _dumps(state).encode()
    etag = '"' + hashlib.sha256(body).hexdigest()[:32] + '"'
    base = h.headers.get('If-None-Match', '')
    if base == etag: return h.not_modified(etag)
    index = _index(state)
    with _lock:
        before = _snapshots.get(base)
        _snapshots[etag] = index
        _snapshots.move_to_end(etag)
        while len(_snapshots) > KEEP: _snapshots.popitem(last=False)
    if before is None: return h.send(body, etag=etag)
    delta = {k: v for k, v in state.items() if k not in TABLES}
    delta['delta'] = base
    for t in TABLES: delta[t] = _table_delta(before[t], index[t], state[t])
    # 增量与整份共用一个 ETag，不能进按 ETag 记忆的 gzip 缓存，所以 ETag 走普通响应头
    h.send(_dumps(delta).encode(), headers={'ETag': etag})
