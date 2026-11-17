// 账本统计：纯函数，从 records / sales / shipments 算出利润、库存成本、每月收支。
// 口径：利润只算已确认收货（含旧版「仅退款、买家留着专辑」）；已发货退货的损失计入退款当月；
// 未发货退款不算损失。买入支出按买入日期，金额取成本（运费已摊入），成本待补的单独计数。
import type {AlbumRecord, Sale, Shipment} from '../types';
import {yuan} from './format';

const n = (v: unknown): number => Number(v || 0);
const r2 = (v: number): number => Math.round(v * 100) / 100;

export interface LedgerMonth {
  /** YYYY-MM */
  key: string;
  buy: number;
  buyCount: number;
  buyUnknown: number;
  net: number;
  sold: number;
  profit: number;
  /** 已售但成本待补、未计入利润的张数 */
  unknown: number;
  returned: number;
}

export interface LedgerSummary {
  net: number;
  sold: number;
  profit: number;
  /** 利润率 = 成本已知的那部分利润 / 那部分到手；没有成本已知的售出时为 null */
  margin: number | null;
  loss: number;
  returned: number;
  unknown: number;
  buy: number;
}

/** 一笔交易落在哪个月、算不算实现：已确认收货按收货日；已发货退货按退款日；其余不计 */
function saleMonth(s: Sale): {key: string; kind: 'sold' | 'returned'} | null {
  if (s.status === 'complete') return {key: (s.receivedDate || s.date).slice(0, 7), kind: 'sold'};
  if (s.status === 'returned') return {key: (s.refundDate || s.date).slice(0, 7), kind: 'returned'};
  if (s.status === 'refunded' && !s.unshipped) return {key: (s.receivedDate || s.refundDate || s.date).slice(0, 7), kind: 'sold'};
  return null;
}

const blank = (key: string): LedgerMonth => ({key, buy: 0, buyCount: 0, buyUnknown: 0, net: 0, sold: 0, profit: 0, unknown: 0, returned: 0});

/** 全部月份（新的在前）。records 里回收站的不算买入 */
export function ledgerMonths(records: AlbumRecord[], sales: Sale[]): LedgerMonth[] {
  const map = new Map<string, LedgerMonth>();
  const at = (k: string) => { let m = map.get(k); if (!m) map.set(k, m = blank(k)); return m; };
  for (const r of records) {
    if (r.status === 'trash' || !r.date) continue;
    const m = at(r.date.slice(0, 7));
    m.buyCount++;
    if (r.cost === null || r.cost === '') m.buyUnknown++; else m.buy += n(r.cost);
  }
  for (const s of sales) {
    const w = saleMonth(s);
    if (!w || !w.key) continue;
    const m = at(w.key);
    if (w.kind === 'returned') { m.returned++; m.profit += s.items.reduce((t, i) => t + n(i.profit), 0); continue; }
    for (const i of s.items) {
      m.sold++; m.net += n(i.net);
      if (i.profit === null) m.unknown++; else m.profit += n(i.profit);
    }
  }
  return [...map.values()].map(m => ({...m, buy: r2(m.buy), net: r2(m.net), profit: r2(m.profit)}))
    .sort((a, b) => b.key.localeCompare(a.key));
}

/** 汇总一组月份；利润率另需成本已知那部分的到手，所以直接从 sales 算 */
export function ledgerSummary(months: LedgerMonth[], sales: Sale[], year?: string): LedgerSummary {
  let knownNet = 0, knownProfit = 0, loss = 0;
  for (const s of sales) {
    const w = saleMonth(s);
    if (!w || (year && !w.key.startsWith(year))) continue;
    for (const i of s.items) {
      if (w.kind === 'returned') { loss += n(i.profit); continue; }
      if (i.profit !== null) { knownNet += n(i.net); knownProfit += n(i.profit); }
    }
  }
  const t = months.reduce((a, m) => ({net: a.net + m.net, sold: a.sold + m.sold, profit: a.profit + m.profit,
    returned: a.returned + m.returned, unknown: a.unknown + m.unknown, buy: a.buy + m.buy}),
    {net: 0, sold: 0, profit: 0, returned: 0, unknown: 0, buy: 0});
  return {net: r2(t.net), sold: t.sold, profit: r2(t.profit), returned: t.returned, unknown: t.unknown, buy: r2(t.buy),
    loss: r2(loss), margin: knownNet > 0 ? knownProfit / knownNet : null};
}

/** 有数据的年份，新的在前 */
export const ledgerYears = (months: LedgerMonth[]): string[] =>
  [...new Set(months.map(m => m.key.slice(0, 4)))].sort().reverse();

export interface StockBucket { count: number; cost: number; unknown: number; listed: number }

export function stockBucket(rs: AlbumRecord[]): StockBucket {
  let cost = 0, unknown = 0, listed = 0;
  for (const r of rs) {
    if (r.cost === null || r.cost === '') unknown++; else cost += n(r.cost);
    if (r.listed) listed++;
  }
  return {count: rs.length, cost: r2(cost), unknown, listed};
}

/** 往期包裹寄出到签收的平均天数（四舍五入）；没有已签收的包裹时为 null */
export function avgTransitDays(shipments: Shipment[]): number | null {
  const ds = shipments.filter(s => s.status === 'arrived' && s.date && s.arrivedDate)
    .map(s => (Date.parse(s.arrivedDate) - Date.parse(s.date)) / 86400000)
    .filter(d => Number.isFinite(d) && d >= 0);
  return ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : null;
}

/** 带正负号的金额：+¥12.00 / −¥12.00 / ¥0.00 */
export const signedYuan = (v: number): string => (v > 0 ? '+' : v < 0 ? '−' : '') + yuan(Math.abs(v));
