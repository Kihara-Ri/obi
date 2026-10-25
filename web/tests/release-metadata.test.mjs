import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';
import {compiledSources} from './helpers/compiled-sources.mjs';

const {output, require} = compiledSources();
const {displayReleaseTitle, releaseRegion, regionName, displayRegion} = require(join(output, 'core/release-metadata.js'));

test('MusicBrainz editorial square brackets do not pollute display titles', () => {
  assert.equal(displayReleaseTitle('[Led Zeppelin IV]'), 'Led Zeppelin IV');
  assert.equal(displayReleaseTitle('Led Zeppelin [IV]'), 'Led Zeppelin [IV]');
  assert.equal(displayReleaseTitle('[[untitled]]'), '[[untitled]]');
});
test('Release country maps to the historical Japan/overseas labels, never inventory location', () => {
  assert.equal(releaseRegion('JP'), '日版');
  assert.equal(releaseRegion('US'), '外版');
  assert.equal(releaseRegion('GB'), '外版');
  assert.equal(releaseRegion('', '日版'), '日版');
  assert.equal(releaseRegion(''), '');
});

test('列表与详情显示地区名；国家未知才退回日版 / 外版；表外代码原样显示', () => {
  assert.equal(regionName('US'), '美国');
  assert.equal(regionName('jp'), '日本');
  assert.equal(regionName('XE'), '欧洲');
  assert.equal(regionName('ZZ'), 'ZZ');
  assert.equal(displayRegion('GB', '外版'), '英国');
  assert.equal(displayRegion('', '日版'), '日版');
  assert.equal(displayRegion(undefined, ''), '');
  // 存储口径不变：releaseRegion 仍是日版 / 外版（pressing 字段的语义不得改）
  assert.equal(releaseRegion('US'), '外版');
});
