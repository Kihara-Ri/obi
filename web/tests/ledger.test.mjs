import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';

const {output, require} = compiledSources();
const {ledgerMonths, ledgerSummary, ledgerYears, stockBucket, avgTransitDays} = require(join(output, 'core/ledger.js'));

const rec = (id, date, cost, extra = {}) => ({id, date, cost, status: 'domestic', ...extra});
const item = (recordId, net, profit) => ({recordId, net, profit});
const records = [
  rec('a', '2026-08-02', '100.00'), rec('b', '2026-08-20', null), rec('c', '2026-09-01', '50.00'),
  rec('d', '2025-12-30', '30.00'), rec('x', '2026-09-03', '999.00', {status: 'trash'}),
];
const sales = [
  {status: 'complete', date: '2026-09-02', receivedDate: '2026-09-10', items: [item('a', '180.00', '80.00'), item('b', '60.00', null)]},
  {status: 'returned', date: '2026-08-25', refundDate: '2026-09-05', items: [item('c', '-12.00', '-12.00')]},
  {status: 'refunded', unshipped: true, date: '2026-09-06', refundDate: '2026-09-07', items: [item('c', '0.00', '0.00')]},
  {status: 'shipping', date: '2026-09-08', items: [item('d', '40.00', '10.00')]},
  {status: 'complete', date: '2025-12-31', receivedDate: '2026-01-04', items: [item('d', '45.00', '15.00')]},
];

test('每月收支：买入按买入日、售出按收货日、退货按退款日，回收站和未发货退款不算', () => {
  const ms = ledgerMonths(records, sales);
  assert.deepEqual(ms.map(m => m.key), ['2026-09', '2026-08', '2026-01', '2025-12']);
  const sep = ms[0];
  assert.equal(sep.buy, 50); assert.equal(sep.buyCount, 1);
  assert.equal(sep.net, 240); assert.equal(sep.sold, 2); assert.equal(sep.unknown, 1);
  assert.equal(sep.returned, 1); assert.equal(sep.profit, 68);
  assert.equal(ms[1].buy, 100); assert.equal(ms[1].buyUnknown, 1); assert.equal(ms[1].net, 0);
});

test('汇总：按年份筛，利润率只看成本已知的部分，退货损失单列且已计入利润', () => {
  const ms = ledgerMonths(records, sales);
  const y = ledgerSummary(ms.filter(m => m.key.startsWith('2026')), sales, '2026');
  assert.equal(y.profit, 83); assert.equal(y.net, 285); assert.equal(y.loss, -12);
  assert.equal(y.sold, 3); assert.equal(y.unknown, 1);
  assert.ok(Math.abs(y.margin - 95 / 225) < 1e-9);
  assert.deepEqual(ledgerYears(ms), ['2026', '2025']);
  assert.equal(ledgerSummary([], [], '2024').margin, null);
});

test('库存分桶与平均在途天数', () => {
  assert.deepEqual(stockBucket([rec('a', '', '10.10', {listed: true}), rec('b', '', null), rec('c', '', '0.20')]),
    {count: 3, cost: 10.3, unknown: 1, listed: 1});
  assert.equal(avgTransitDays([]), null);
  assert.equal(avgTransitDays([
    {status: 'arrived', date: '2026-08-01', arrivedDate: '2026-08-09'},
    {status: 'arrived', date: '2026-09-01', arrivedDate: '2026-09-12'},
    {status: 'transit', date: '2026-10-01', arrivedDate: ''},
  ]), 10);
});
