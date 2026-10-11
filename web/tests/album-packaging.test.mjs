import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const output = mkdtempSync(join(tmpdir(), 'diedu-packaging-test-'));
const source = fileURLToPath(new URL('../src/', import.meta.url));
let packaging, assets;
try {
  const program = ts.createProgram([join(source, 'core/album-packaging.ts'), join(source, 'core/album-model-assets.ts')], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, strict: true,
    skipLibCheck: true, types: [], rootDir: source, outDir: output,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => source, getCanonicalFileName: name => name, getNewLine: () => '\n',
  }));
  assert.equal(program.emit().emitSkipped, false);
  writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
  packaging = createRequire(import.meta.url)(join(output, 'core/album-packaging.js'));
  assets = createRequire(import.meta.url)(join(output, 'core/album-model-assets.js'));
} catch (error) {rmSync(output, {recursive: true, force: true}); throw error;}
after(() => rmSync(output, {recursive: true, force: true}));

test('真实模型按结构和托盘选择，2CD 不使用 Fatbox，未知不使用塑料盒', () => {
  assert.equal(assets.albumModelAsset(packaging.albumPackaging('2CD Jewel Case')), '/models/packaging/jewel-swing-2.glb');
  assert.equal(assets.albumModelAsset(packaging.albumPackaging('Multi-CD Jewel Case')), '/models/packaging/jewel-fat.glb');
  assert.equal(assets.albumModelAsset(packaging.albumPackaging('Slimline Jewel Case')), '/models/packaging/slimline-jewel.glb');
  assert.equal(assets.albumModelAsset(packaging.albumPackaging('紙ジャケット')), '/models/packaging/neutral.glb');
  assert.equal(assets.albumModelAsset(packaging.albumPackaging('Digipak', {panels: 4})), '/models/packaging/digipak-4.glb');
});

test('当前副本贴图引用保留照片身份，缺背图不重复正面', () => {
  const record = {id: 'fixture', revision: 5, photoCount: 3, cover: '/api/cover/fixture.png', packaging: {photos: {back: 2}}};
  assert.equal(assets.albumTextureSource(record, 'front'), record.cover);
  assert.equal(assets.albumTextureSource(record, 'back'), '/api/photo/fixture/2?v=5');
  assert.equal(assets.albumTextureSource(record, 'insideLeft'), '');
  assert.equal(assets.albumTextureSource({...record, packaging: {photos: {front: 9}}}, 'front'), '');
  assert.equal(assets.albumTextureSource({...record, packaging: {photoRegions: {
    insideLeft: [0, 0, 1, 0, 1, 1, 0, 1],
  }}}, 'insideLeft'), '');
});

test('折页盘面分配及单侧口袋保留本张副本的独立盘面编号', () => {
  const model = packaging.albumPackaging('Digipak', {discs: 4, panels: 3});
  assert.deepEqual([0, 1, 2].map(panel => assets.albumPanelDiscs(model, panel)), [[0], [1], [2, 3]]);
  const pocket = packaging.albumPackaging('Gatefold Sleeve', {discs: 2, pockets: 'left'});
  assert.deepEqual(assets.albumPanelDiscs(pocket, 0), [0, 1]);
  assert.deepEqual(assets.albumPanelDiscs(pocket, 1), []);
});

test('专业名称对应六种结构，LP 复刻及外套保持独立属性', () => {
  for (const [version, kind] of [['Jewel Case', 'jewel'], ['Card Sleeve', 'card-sleeve'],
    ['Gatefold Sleeve', 'gatefold'], ['Digisleeve', 'gatefold'], ['Digipak', 'digipak'],
    ['Digibook', 'digibook'], ['Rigid Box', 'rigid-box']]) {
    assert.equal(packaging.albumPackaging(version).kind, kind, version);
  }
  const replica = packaging.albumPackaging('Mini LP Sleeve');
  assert.equal(replica.kind, 'card-sleeve');
  assert.equal(replica.miniLP, true);
  const gatefold = packaging.albumPackaging('紙ジャケット', {structure: 'gatefold', miniLP: true, slipcase: true});
  assert.equal(gatefold.label, 'Gatefold Sleeve · Mini LP + Slipcase');
});

test('模糊的紙ジャケット、纸盒和 Mini LP 不自动猜成单口袋', () => {
  for (const name of ['紙ジャケット', '紙ジャケ', '纸盒', '纸质', 'Mini LP', '初回限定', '2CD', '']) {
    assert.equal(packaging.albumPackaging(name).kind, 'unknown', name);
  }
  assert.equal(packaging.albumPackaging('シングル紙ジャケット').kind, 'card-sleeve');
  assert.equal(packaging.albumPackaging('見開き紙ジャケット').kind, 'gatefold');
  assert.ok(packaging.packagingSuggestions('紙ジャケット').length > 1);
});

test('2CD 和 Double 不增加塑料盒厚度，明确 Fatbox 才增加', () => {
  const normal = packaging.albumPackaging('Jewel Case');
  for (const name of ['2CD Jewel Case', '双碟 Jewel Case', 'Double Disc Jewel Case']) {
    const item = packaging.albumPackaging(name);
    assert.equal(item.depth, normal.depth, name);
    assert.equal(item.discs, 2);
  }
  for (const name of ['Fat Box Jewel Case', '厚塑料盒', 'Multi-CD Jewel Case']) {
    const item = packaging.albumPackaging(name);
    assert.equal(item.kind, 'jewel');
    assert.ok(item.depth > normal.depth);
    assert.equal(item.label, 'Multi-CD Jewel Case');
  }
  assert.ok(packaging.albumPackaging('Slimline Jewel Case').depth < normal.depth);
});

test('显式确认的副本结构优先于旧名称，旧文字不被修改', () => {
  const spec = Object.freeze({structure: 'gatefold', panels: 3, finish: 'gloss'});
  const result = packaging.albumPackaging('纸盒', spec);
  assert.equal(result.kind, 'gatefold');
  assert.equal(result.label, '6-panel Digisleeve');
  assert.deepEqual(spec, {structure: 'gatefold', panels: 3, finish: 'gloss'});
  assert.equal(packaging.formatPackagingName('纸盒'), '纸盒');
  assert.equal(packaging.formatPackagingName('纸盒', spec), '6-panel Digisleeve');
  assert.equal(packaging.albumPackaging('Jewel Case', {structure: 'unknown'}).kind, 'unknown');
  assert.equal(packaging.formatPackagingName('Jewel Case', {structure: 'unknown'}), '待核对');
});

test('纸材也支持亮光覆膜，尺寸是本张副本的显式测量值', () => {
  const matte = packaging.albumPackaging('Digipak', {finish: 'matte'});
  const glossy = packaging.albumPackaging('Digipak', {finish: 'gloss', size: {width: 140, height: 125, depth: 8}});
  assert.ok(glossy.gloss > matte.gloss);
  assert.equal(glossy.aspect, 140 / 125);
  assert.equal(glossy.depth, 8 / 140);
});

test('各结构开合能力来自结构本身，单口袋不能翻成一本书', () => {
  assert.equal(packaging.albumPackaging('Card Sleeve').canOpen, false);
  assert.equal(packaging.albumPackaging('Card Sleeve', {slipcase: true}).canOpen, true);
  for (const name of ['Jewel Case', 'Gatefold Sleeve', 'Digipak', 'Digibook', 'Rigid Box'])
    assert.equal(packaging.albumPackaging(name).canOpen, true, name);
  assert.equal(packaging.albumPackaging('纸盒').canOpen, false);
});

test('双碟内开口纸套仍为两块折页，未指定开口方向保持原外开口默认', () => {
  const inner = packaging.albumPackaging('Gatefold Sleeve', {
    structure: 'gatefold', panels: 2, holder: 'pocket', pockets: 'both', discs: 2, pocketOpening: 'inner',
  });
  assert.equal(inner.pocketOpening, 'inner');
  assert.equal(inner.panels, 2);
  assert.equal(inner.pockets, 'both');
  assert.equal(inner.discs, 2);
  assert.equal(packaging.albumPackaging('Gatefold Sleeve').pocketOpening, 'outer');
  assert.equal(packaging.albumPackaging('Jewel Case', {pocketOpening: 'inner'}).pocketOpening, 'inner');
});

test('照片删除/重排按原照片身份更新贴图，新增照片不会误继承旧贴图', () => {
  const spec = Object.freeze({structure: 'gatefold', photos: Object.freeze({front: 0, back: 1, insideRight: 2})});
  assert.deepEqual(packaging.remapPackagingPhotos(spec, [2, 'new image', 0]).photos, {front: 2, insideRight: 0});
  assert.deepEqual(packaging.remapPackagingPhotos(spec, []).photos, {});
  assert.deepEqual(spec.photos, {front: 0, back: 1, insideRight: 2});
  assert.equal(packaging.remapPackagingPhotos(null, []), null);
});

test('照片区域跟随绑定照片重排，删除照片清除区域而不裁切替代封面', () => {
  const left = Object.freeze([0, 0, .45, 0, .45, 1, 0, 1]);
  const right = Object.freeze([.55, 0, 1, 0, 1, 1, .55, 1]);
  const spec = Object.freeze({structure: 'gatefold', photos: Object.freeze({front: 0, insideLeft: 1, insideRight: 2}),
    photoRegions: Object.freeze({front: left, insideLeft: left, insideRight: right})});
  const reordered = packaging.remapPackagingPhotos(spec, [2, 'new photo', 0]);
  assert.deepEqual(reordered.photos, {front: 2, insideRight: 0});
  assert.deepEqual(reordered.photoRegions, {front: left, insideRight: right});
  assert.deepEqual(packaging.remapPackagingPhotos(spec, []).photoRegions, {});
  const coverRegion = packaging.remapPackagingPhotos({photoRegions: {front: left, insideLeft: right}}, []);
  assert.deepEqual(coverRegion.photoRegions, {front: left});
  assert.deepEqual(spec.photoRegions, {front: left, insideLeft: left, insideRight: right});
});

test('贴图角色改选及清空丢弃旧区域，同时保留其他角色和隐藏结构资料', () => {
  const region = Object.freeze([0, 0, 1, 0, 1, 1, 0, 1]);
  const spec = Object.freeze({structure: 'gatefold', pocketOpening: 'inner', photos: Object.freeze({front: 0, insideLeft: 1}),
    photoRegions: Object.freeze({front: region, insideLeft: region})});
  const changed = packaging.setPackagingPhoto(spec, 'insideLeft', 2);
  assert.deepEqual(changed.photos, {front: 0, insideLeft: 2});
  assert.deepEqual(changed.photoRegions, {front: region});
  assert.equal(changed.pocketOpening, 'inner');
  const cleared = packaging.setPackagingPhoto(spec, 'front', undefined);
  assert.deepEqual(cleared.photos, {insideLeft: 1});
  assert.deepEqual(cleared.photoRegions, {insideLeft: region});
  assert.deepEqual(spec.photoRegions, {front: region, insideLeft: region});
});

test('包装选择项均采用专业名称，可保存后再次定位预设', () => {
  for (const preset of packaging.PACKAGING_PRESETS) {
    assert.equal(packaging.packagingPreset(preset.label, preset.spec), preset.value);
    assert.ok(preset.label.match(/Jewel Case|Card Sleeve|Gatefold Sleeve|Digisleeve|Digipak|Digibook|Rigid Box|Mini LP Sleeve/));
  }
});
