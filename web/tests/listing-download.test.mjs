import assert from 'node:assert/strict';
import test from 'node:test';
import {join} from 'node:path';
import {compiledSources} from './helpers/compiled-sources.mjs';
const {require, output} = compiledSources();
const {downloadFile, fetchPhotoFiles, photoLabel} = require(join(output, 'core/download.js'));

test('explicit desktop ZIP download does not invoke the system share sheet', async () => {
  let clicked = false;
  Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {
    onLine: true, canShare: () => true, share: () => {throw new Error('share must not be called');}}});
  globalThis.fetch = async () => new Response('zip', {headers: {'Content-Type': 'application/zip'}});
  globalThis.document = {createElement: () => ({click: () => {clicked = true;}, remove() {}}), body: {appendChild() {}}};
  assert.equal(await downloadFile('listing/photos', 'photos.zip', {share: false}), 'photos.zip');
  assert.equal(clicked, true);
});

test('photo label matches the server archive naming and strips illegal characters', () => {
  assert.equal(photoLabel('AC/DC', 'Back: In "Black"?'), 'AC DC - Back In Black');
  assert.equal(photoLabel('', '盗作'), '盗作');
  assert.equal(photoLabel('a'.repeat(90), 'b'.repeat(90)).length, 103);
});

test('phone photo files keep order, real format and the album name', async () => {
  const types = ['image/jpeg', 'image/png', 'image/webp'];
  globalThis.fetch = async url => new Response('x', {headers: {'Content-Type': types[Number(String(url).split('/').pop())]}});
  const files = await fetchPhotoFiles('abc', 3, 'Artist - Album');
  assert.deepEqual(files.map(f => f.name), ['Artist - Album - 01.jpg', 'Artist - Album - 02.png', 'Artist - Album - 03.webp']);
  assert.deepEqual(files.map(f => f.type), types);
});
