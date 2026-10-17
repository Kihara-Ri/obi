import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';
const {output, require} = compiledSources();
const {mountAlbumEngine} = require(join(output, 'core/album-engine-mount.js'));
const tick = () => new Promise(resolve => setImmediate(resolve));

test('uninstall disposes an existing root exactly once', async () => {
  let disposed = 0;
  const stop = mountAlbumEngine({mount: async () => () => disposed++}, 'viewer', {}, {}, () => assert.fail());
  await tick(); stop(); stop();
  assert.equal(disposed, 1);
});
test('late async engine mount is disposed after host removal', async () => {
  let complete, disposed = 0;
  const stop = mountAlbumEngine({mount: () => new Promise(resolve => {complete = resolve;})}, 'viewer', {}, {}, () => assert.fail());
  await tick(); stop(); complete(() => disposed++); await tick();
  assert.equal(disposed, 1);
});
test('abandoned mount creates no root and late failures cannot change the new view', async () => {
  let mounted = 0;
  const stop = mountAlbumEngine({mount: async () => {mounted++;}}, 'viewer', {}, {}, () => assert.fail());
  stop(); await tick(); assert.equal(mounted, 0);
  let reject;
  const late = mountAlbumEngine({mount: () => new Promise((_, fail) => {reject = fail;})}, 'viewer', {}, {}, () => assert.fail());
  await tick(); late(); reject(new Error('missing plugin')); await tick();
});
test('active mount errors return the host to ordinary artwork', async () => {
  let failed = 0;
  const stop = mountAlbumEngine({mount: async () => {throw new Error('WebGL unavailable');}}, 'viewer', {}, {}, () => failed++);
  await tick(); assert.equal(failed, 1); stop();
});

test('absent plugin cannot resolve or import any executable URL', async () => {
  const {loadAlbumEngine} = require(join(output, 'core/album-engine-plugin.js'));
  await assert.rejects(loadAlbumEngine({installed: false, entryUrl: '/api/plugins/album-engine/assets/browser/plugin.js'}), /请先安装/);
});
test('plugin bridge rejects off-origin and non-plugin entry points before import', async () => {
  const {loadAlbumEngine} = require(join(output, 'core/album-engine-plugin.js'));
  const previous = globalThis.location;
  globalThis.location = {origin: 'http://localhost'};
  try {
    await assert.rejects(loadAlbumEngine({installed: true, entryUrl: 'https://example.invalid/entry.js'}), /入口无效/);
    await assert.rejects(loadAlbumEngine({installed: true, entryUrl: '/assets/index.js'}), /入口无效/);
  } finally {if (previous === undefined) delete globalThis.location; else globalThis.location = previous;}
});
