import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';
import {compiledSources} from './helpers/compiled-sources.mjs';

// 与 tests/test_state_sync.py 的 apply_delta 同一拼法：没变也没消失的行保持原顺序，put 接在后面，order 优先
const {output, require} = compiledSources();
const {applyTable, applyStateDelta, fetchState} = require(join(output, 'core/state-sync.js'));

const base = () => ({format: 'album-ledger', schema: 4, settings: {}, modules: {}, service: {login: true},
  records: [{id: 'a', t: 1}, {id: 'b', t: 1}, {id: 'c', t: 1}], sales: [], shipments: [],
  audit: [{id: 1, at: 'x', action: 'save'}]});

test('applyTable：改动的行移到末尾，消失的行去掉，没变的行保持原对象', () => {
  const rows = base().records;
  const next = applyTable(rows, {put: [{id: 'b', t: 2}, {id: 'd', t: 1}], drop: ['c']});
  assert.deepEqual(next, [{id: 'a', t: 1}, {id: 'b', t: 2}, {id: 'd', t: 1}]);
  assert.equal(next[0], rows[0]);
});

test('applyTable：服务器给了 order 就按它排', () => {
  assert.deepEqual(applyTable(base().records, {put: [], drop: [], order: ['c', 'a', 'b']}).map(r => r.id), ['c', 'a', 'b']);
});

test('applyStateDelta：表以外的字段整份替换，不带 delta 标记', () => {
  const next = applyStateDelta(base(), {delta: '"x"', format: 'album-ledger', schema: 4, settings: {g: 1},
    modules: {}, service: {login: false}, records: {put: [], drop: ['a']}, sales: {put: [], drop: []},
    shipments: {put: [], drop: []}, audit: {put: [{id: 2, at: 'y', action: 'bulk'}], drop: [1]}});
  assert.equal('delta' in next, false);
  assert.deepEqual(next.settings, {g: 1});
  assert.deepEqual(next.records.map(r => r.id), ['b', 'c']);
  assert.deepEqual(next.audit.map(r => r.id), [2]);
});

function stubFetch(responses) {
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push(init.headers['If-None-Match'] || '');
    const {status, body, etag} = responses.shift();
    return {status, ok: status >= 200 && status < 300, headers: {get: () => etag},
            json: async () => { if (body === undefined) throw new Error('empty'); return body; }};
  };
  return seen;
}

test('fetchState：304 返回 null；增量拼到请求时那份上；基线对不上就整份重拉', async () => {
  const first = base();
  const seen = stubFetch([
    {status: 200, body: first, etag: '"1"'},
    {status: 304, etag: '"1"'},
    {status: 200, etag: '"2"', body: {...first, delta: '"1"', records: {put: [{id: 'a', t: 9}], drop: []},
      sales: {put: [], drop: []}, shipments: {put: [], drop: []}, audit: {put: [], drop: []}}},
    {status: 200, etag: '"3"', body: {...first, delta: '"zz"', records: {put: [], drop: []},
      sales: {put: [], drop: []}, shipments: {put: [], drop: []}, audit: {put: [], drop: []}}},
    {status: 200, body: first, etag: '"3"'},
  ]);
  const one = await fetchState(null);
  assert.equal(one.etag, '"1"');
  assert.equal(await fetchState(one), null);
  const two = await fetchState(one);
  assert.deepEqual(two.state.records.map(r => [r.id, r.t]), [['b', 1], ['c', 1], ['a', 9]]);
  assert.equal(two.state.records[0], one.state.records[1]);
  const three = await fetchState(two);
  assert.equal(three.etag, '"3"');
  assert.deepEqual(seen, ['', '"1"', '"1"', '"2"', '']);
});

test('fetchState：401 抛带状态码的 ApiError（首屏据此跳登录页）', async () => {
  stubFetch([{status: 401, body: {error: '请先登录'}, etag: null}]);
  await assert.rejects(fetchState(null), e => e.status === 401 && e.message === '请先登录');
});
