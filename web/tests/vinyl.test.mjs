import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';

const {output, require} = compiledSources();
const vinyl = require(join(output, 'core/vinyl.js'));
const pkg = require(join(output, 'core/album-packaging.js'));
const {toAlbumEntity} = require(join(output, 'core/album-entity.js'));

test('黑胶包装预设不带 3D 结构，图标与中文名有自己的键（D-055）', () => {
  for (const {label, value, zh} of vinyl.VINYL_PACKAGING) {
    assert.equal(pkg.packagingKind(label), value);
    assert.equal(pkg.packagingDisplay(label).name, zh);
    assert.equal(pkg.albumPackaging(label).kind, 'unknown');
    assert.equal(pkg.formatPackagingName(label), label);
  }
  // CD 的对折纸套不受影响
  assert.equal(pkg.packagingKind('Gatefold Sleeve'), 'gatefold');
});

test('资料库包装名换成黑胶预设，认不出留空', () => {
  assert.equal(vinyl.vinylPackagingFromCatalog('Gatefold Cover'), 'Gatefold Jacket');
  assert.equal(vinyl.vinylPackagingFromCatalog('Cardboard/Paper Sleeve'), 'Single Jacket');
  assert.equal(vinyl.vinylPackagingFromCatalog('Box'), 'Box Set');
  assert.equal(vinyl.vinylPackagingFromCatalog('Single Jacket'), 'Single Jacket');
  assert.equal(vinyl.vinylPackagingFromCatalog('Jewel Case'), '');
  assert.equal(vinyl.vinylPackagingFromCatalog(''), '');
});

test('尺寸优先副本填写，没填从格式认；规格与品相拼成一行', () => {
  const info = {format: '2×12" Vinyl'};
  assert.equal(vinyl.vinylSize(null, info), '12');
  assert.equal(vinyl.vinylSize({size: '10'}, info), '10');
  assert.equal(vinyl.vinylSize(null, {media: [{position: 1, format: '7"', title: ''}]}), '7');
  assert.equal(vinyl.vinylSpecText({speed: '33', color: '红'}, info), '12″ · 33⅓ 转 · 彩胶（红）');
  assert.equal(vinyl.gradeText({mediaGrade: 'NM', sleeveGrade: 'VG+'}), '唱片 NM / 封套 VG+');
  assert.equal(vinyl.gradeText({}), '');
  assert.equal(vinyl.vinylTag(null, {format: 'Vinyl'}), '黑胶');
  assert.deepEqual(vinyl.cleanVinyl({size: '12', color: ' ', speed: undefined}), {size: '12'});
  assert.equal(vinyl.cleanVinyl({color: ''}), null);
});

test('黑胶副本即使残留 CD 结构也不进 CD 模型', () => {
  const record = {id: 'r', title: 'T', artist: 'A', version: 'Jewel Case', packaging: {structure: 'jewel'},
    releaseInfo: {format: '12" Vinyl'}};
  assert.equal(toAlbumEntity(record).packaging.structure, 'unknown');
  assert.equal(toAlbumEntity({...record, releaseInfo: {format: 'CD'}}).packaging.structure, 'jewel');
});
