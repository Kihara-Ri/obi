// /api/state 的条件请求与增量拼装，与 server/state_sync.py 一一对应。
// 内容没变：服务器回 304，这里返回 null，调用方不更新状态、不重渲染。
// 服务器还记得上次那份：只收变化的行（put）与消失的行（drop），在本地拼回完整状态；
// 没变的行保持原对象，按行记忆的组件不用重算。拼法改动要同步 tests/test_state_sync.py 的 apply_delta。
import {ApiError} from './api';
import type {AppState} from '../types';

const TABLES = ['records', 'sales', 'shipments', 'audit'] as const;
type Table = typeof TABLES[number];
type Row = {id?: string | number};

export interface TableDelta<T extends Row = Row> {
  put: T[];
  drop: Array<string | number>;
  order?: Array<string | number>;   // 拼出来的顺序与服务器不同时才有
}

export type StateDelta = Omit<AppState, Table> & {delta: string} & {[K in Table]: TableDelta<AppState[K][number] & Row>};

export interface StateSnapshot {
  state: AppState;
  etag: string;
}

export function applyTable<T extends Row>(base: T[], d: TableDelta<T>): T[] {
  const changed = new Set(d.put.map(row => row.id));
  const dropped = new Set(d.drop);
  const rows = base.filter(row => !changed.has(row.id) && !dropped.has(row.id!)).concat(d.put);
  if (!d.order) return rows;
  const byId = new Map(rows.map(row => [row.id, row]));
  return d.order.map(id => byId.get(id)!);
}

export function applyStateDelta(base: AppState, d: StateDelta): AppState {
  const {delta: _base, records, sales, shipments, audit, ...rest} = d;
  return {
    ...rest,
    records: applyTable(base.records, records),
    sales: applyTable(base.sales, sales),
    shipments: applyTable(base.shipments, shipments),
    audit: applyTable(base.audit as Array<AppState['audit'][number] & Row>, audit),
  };
}

/** 带着手上那份的 ETag 拉状态；没变返回 null。错误语义与 api('state') 相同（401 → ApiError.status）。 */
export async function fetchState(base: StateSnapshot | null): Promise<StateSnapshot | null> {
  const r = await fetch('/api/state', {
    // 手动带 If-None-Match 的请求不经浏览器 HTTP 缓存，304 原样交给这里；响应本身仍是 no-store
    cache: 'no-store',
    headers: base?.etag ? {'If-None-Match': base.etag} : {},
  });
  if (r.status === 304 && base) return null;
  let x: (AppState | StateDelta) & {error?: string} | undefined;
  try { x = await r.json(); } catch { /* 非 JSON 响应按通用错误处理 */ }
  if (!r.ok || !x) throw new ApiError(x?.error || '操作失败，请重试', r.status);
  const etag = r.headers.get('ETag') || '';
  if (!('delta' in x)) return {state: x, etag};
  // 增量只对请求时带的那份有效；对不上就整份重拉（正常不会发生）
  if (!base || x.delta !== base.etag) return fetchState(null);
  return {state: applyStateDelta(base.state, x), etag};
}
