import assert from 'node:assert/strict';
import test from 'node:test';
import {join} from 'node:path';
import {compiledSources} from './helpers/compiled-sources.mjs';
const {require, output} = compiledSources();
const {downloadFile} = require(join(output, 'core/download.js'));

test('explicit desktop ZIP download does not invoke the system share sheet', async () => {
  let clicked = false;
  Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {
    onLine: true, canShare: () => true, share: () => {throw new Error('share must not be called');}}});
  globalThis.fetch = async () => new Response('zip', {headers: {'Content-Type': 'application/zip'}});
  globalThis.document = {createElement: () => ({click: () => {clicked = true;}, remove() {}}), body: {appendChild() {}}};
  assert.equal(await downloadFile('listing/photos', 'photos.zip', {share: false}), 'photos.zip');
  assert.equal(clicked, true);
});
