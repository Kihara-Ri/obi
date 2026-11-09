import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
const context = vm.createContext({Headers, TextEncoder, Uint8Array, ArrayBuffer, crypto: webcrypto});
vm.runInContext(readFileSync(new URL('../../static/local/write-journal.js', import.meta.url), 'utf8'), context);
const Journal = context.ObiWriteJournal;
const message = (id, retry = false, body = 'same') => ({method: 'POST', target: '/api/records',
  headers: {'X-Obi-Operation': id, 'X-Obi-Retry': retry ? '1' : '0', 'Content-Type': 'application/json'},
  body: new TextEncoder().encode(body).buffer});

test('failed persistence blocks new mutations and retries only flush, including lost responses', async () => {
  let runs = 0, writes = 0, fail = true;
  const journal = new Journal(() => ({status: 200, headers: {}, body: new Uint8Array([++runs])}),
    async () => {writes++; if (fail) throw Error('quota');});
  assert.equal((await journal.execute(message('a'))).status, 507);
  assert.equal((await journal.execute(message('b'))).status, 507);
  assert.equal((await journal.execute(message('a', true, 'changed'))).status, 409);
  assert.equal(runs, 1);
  fail = false;
  assert.equal((await journal.execute(message('a', true))).status, 200);
  assert.equal((await journal.execute(message('a', true))).body[0], 1);
  assert.equal(runs, 1); assert.equal(writes, 2);
  assert.equal((await journal.execute(message('b'))).status, 200);
  assert.equal(runs, 2);
});

test('unknown retry after restart never executes the mutation', async () => {
  const journal = new Journal(() => {throw Error('must not execute');}, async () => {});
  assert.equal((await journal.execute(message('old', true))).status, 409);
});

test('bounded receipts evict safely and GET does not require a write receipt', async () => {
  let runs = 0;
  const journal = new Journal(() => ({status: 200, headers: {}, body: new Uint8Array([++runs])}), async () => {});
  for (let i = 0; i < 40; i++) await journal.execute(message(String(i)));
  assert.equal(journal.receipts.size, 32);
  assert.equal((await journal.execute(message('0', true))).status, 409);
  assert.equal(runs, 40);
  assert.equal((await journal.execute({method: 'GET'})).status, 200);
});

test('client keeps operation identity across persistence/network failures and clears only confirmed results', async () => {
  const {compiledSources} = await import('./helpers/compiled-sources.mjs');
  const {output, require} = compiledSources();
  const {localWrite} = require(output + '/core/local-write.js');
  const previous = {document: globalThis.document, sessionStorage: globalThis.sessionStorage, fetch: globalThis.fetch};
  const entries = new Map(), requests = [];
  globalThis.document = {querySelector: () => ({})};
  globalThis.sessionStorage = {getItem: k => entries.get(k) ?? null,
    setItem: (k, v) => entries.set(k, v), removeItem: k => entries.delete(k)};
  globalThis.fetch = async (url, init) => {
    requests.push(init.headers);
    return new Response('{}', {status: requests.length === 1 ? 507 : 200,
      headers: requests.length === 1 ? {} : {'X-Obi-Operation-Complete': '1'}});
  };
  try {
    await localWrite('/api/records', {method: 'POST', body: '{}'});
    assert.equal(entries.size, 1);
    await localWrite('/api/records', {method: 'POST', body: '{}'});
    assert.equal(requests[0].get('X-Obi-Operation'), requests[1].get('X-Obi-Operation'));
    assert.equal(requests[1].get('X-Obi-Retry'), '1');
    assert.equal(entries.size, 0);
    globalThis.fetch = async () => {throw Error('disconnected');};
    await assert.rejects(localWrite('/api/records', {method: 'POST', body: '{}'}));
    assert.equal(entries.size, 1);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
