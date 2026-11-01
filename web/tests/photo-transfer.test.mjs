import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';
import {compiledSources} from './helpers/compiled-sources.mjs';

const {output, require} = compiledSources();
const {PhotoTransferQueue} = require(join(output, 'core/photo-transfer.js'));
const {api, apiUpload, ApiError} = require(join(output, 'core/api.js'));
const data = 'data:image/jpeg;base64,YWJj';
const tick = () => new Promise(resolve => setImmediate(resolve));

test('照片逐张二进制发送，最多并发两张；失败重试保持同一标识', async () => {
  const requests = []; let first = true;
  const queue = new PhotoTransferQueue(async (token, body) => {
    requests.push({token, bytes: await body.text()});
    if (first) {first = false; throw new TypeError('Load failed');}
    return {ref: token};
  }, async () => {});
  assert.equal(await queue.add(data, 'a'.repeat(32)), 'a'.repeat(32));
  assert.deepEqual(requests, [{token: 'a'.repeat(32), bytes: 'abc'}, {token: 'a'.repeat(32), bytes: 'abc'}]);

  const gates = [], seen = [];
  const parallel = new PhotoTransferQueue((token) => new Promise(resolve => {
    seen.push(token); gates.push(() => resolve({ref: token}));
  }));
  const jobs = ['a', 'b', 'c'].map(t => parallel.add(data, t.repeat(32)));
  await tick(); assert.equal(seen.length, 2);
  gates[0](); await jobs[0]; await tick(); assert.equal(seen.length, 3);
  gates[1](); gates[2](); await Promise.all(jobs);
});

test('权限/格式错误不自动重试，后续照片不会被失败任务阻塞', async () => {
  let calls = 0;
  const queue = new PhotoTransferQueue(async token => {
    calls++; if (calls === 1) throw new ApiError('请登录', 401);
    return {ref: token};
  }, async () => {});
  await assert.rejects(queue.add(data, 'a'.repeat(32)), /请登录/);
  assert.equal(calls, 1);
  assert.equal(await queue.add(data, 'b'.repeat(32)), 'b'.repeat(32));
});

test('关闭表单取消在途与排队上传，不再发出新请求', async () => {
  let calls = 0;
  const queue = new PhotoTransferQueue((token, body, signal) => new Promise((resolve, reject) => {
    calls++; signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')));
  }));
  const jobs = ['a', 'b', 'c'].map(t => queue.add(data, t.repeat(32)));
  const all = Promise.allSettled(jobs);
  await tick(); queue.dispose();
  assert.ok((await all).every(r => r.status === 'rejected'));
  assert.equal(calls, 2);
});

test('网络失败不把 Safari 的 Load failed 原样暴露，保存结果不伪报成功', async () => {
  const fetchBefore = globalThis.fetch;
  const navBefore = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {value: {onLine: true}, configurable: true});
  globalThis.fetch = async () => {throw new TypeError('Load failed');};
  try {
    await assert.rejects(api('records/metadata', {}), /保存结果尚未确认/);
    await assert.rejects(apiUpload('photos/stage', new Blob(['x']), 'application/octet-stream'), /上传连接中断/);
    globalThis.fetch = async () => ({ok: true, json: async () => {throw new TypeError('Load failed');}});
    await assert.rejects(api('records/metadata', {}), /响应不完整/);
  } finally {
    globalThis.fetch = fetchBefore;
    if (navBefore) Object.defineProperty(globalThis, 'navigator', navBefore);
    else delete globalThis.navigator;
  }
});
