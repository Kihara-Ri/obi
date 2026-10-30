import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';
import {compiledSources} from './helpers/compiled-sources.mjs';

const {output, require} = compiledSources();
const {applyMetadataSave} = require(join(output, 'core/record-metadata.js'));
const {buildMetadataPayload} = require(join(output, 'forms/record/buildPayload.js'));

test('元数据保存合并资料、照片与同专辑笔记，保留成本、利润和当前未知结果', () => {
  const sales = [{id: 's', items: [{profit: '20.00'}]}];
  const old = {etag: '"old"', state: {sales, shipments: [], audit: [{id: 1}], records: [
    {id: 'a', revision: 3, title: '旧名', price: '2000', currency: 'JPY', cost: '94.00', rate: '4.7', photoCount: 1, coverSource: {provider: 'old'}},
    {id: 'b', revision: 2, title: '同专辑', cost: null, noteAlbum: ''},
    {id: 'c', revision: 1, title: '其他专辑', cost: '10.00'},
  ]}};
  const next = applyMetadataSave(old, {ids: ['a'], records: [
    {id: 'a', revision: 4, title: '新名', photoCount: 3, photoRevision: 2, noteAlbum: '新笔记'},
    {id: 'b', revision: 2, title: '同专辑', noteAlbum: '新笔记'},
  ], audit: [{id: 1}, {id: 2}]});
  assert.equal(next.etag, ''); // 下一次普通同步不能对修改前的 ETag 取增量。
  const [a, b, c] = next.state.records;
  assert.equal(a.title, '新名');
  assert.equal(a.cost, '94.00');
  assert.equal(a.rate, '4.7');
  assert.equal(a.price, '2000');
  assert.equal(a.photoCount, 3);
  assert.equal(a.photoRevision, 2);
  assert.equal(a.coverSource, undefined);
  assert.equal(b.cost, null);
  assert.equal(b.noteAlbum, '新笔记');
  assert.equal(c, old.state.records[2]);
  assert.equal(next.state.sales, sales);
  assert.deepEqual(next.state.audit.map(a => a.id), [1, 2]);
});

test('迟到的元数据响应不能覆盖已经更新的记录或审计', () => {
  const record = {id: 'a', revision: 5, title: '较新', cost: null};
  const next = applyMetadataSave({etag: '"new"', state: {records: [record], audit: [{id: 3}]}},
    {records: [{id: 'a', revision: 4, title: '过期'}], audit: [{id: 2}]});
  assert.equal(next.state.records[0], record);
  assert.deepEqual(next.state.audit.map(a => a.id), [2, 3]);
});

test('编辑载荷只提交元数据与照片，不回传买入信息或派生成本', () => {
  const base = {id: 'a', revision: 2, price: '2000', currency: 'JPY', date: '2026-09-01', fees: '20',
    location: 'shop', actual: '', cost: '94', rate: '4.7', status: 'transit', cover: '/api/cover/test.jpg'};
  const v = {...base, title: 'A', artist: 'B', version: 'Jewel Case', packaging: null, releaseInfo: {}, note: '编辑'};
  const body = buildMetadataPayload(base, v, [{existing: 0}]);
  for (const key of ['price', 'currency', 'date', 'fees', 'location', 'actual', 'cost', 'rate', 'status'])
    assert.equal(key in body, false, key);
  assert.equal(body.id, 'a');
  assert.equal(body.revision, 2);
  assert.equal(body.note, '编辑');
  assert.deepEqual(body.photos, [0]);
});
