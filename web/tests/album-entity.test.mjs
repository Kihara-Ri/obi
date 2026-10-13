import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {mkdtempSync, rmSync, writeFileSync, symlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const output = mkdtempSync(join(tmpdir(), 'diedu-entity-test-'));
after(() => rmSync(output, {recursive: true, force: true}));
const source = fileURLToPath(new URL('../src/', import.meta.url));
const program = ts.createProgram([join(source, 'core/album-entity.ts'), join(source, 'core/digital-twins.ts')], {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10,
  strict: true, skipLibCheck: true, types: [], esModuleInterop: true, rootDir: source, outDir: output,
});
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCurrentDirectory: () => source, getCanonicalFileName: name => name, getNewLine: () => '\n',
}));
program.emit();
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), join(output, 'node_modules'), 'dir');
const require = createRequire(import.meta.url);
const {toAlbumEntity, resolveAlbumAsset} = require(join(output, 'core/album-entity.js'));
const {twinViewerRecord} = require(join(output, 'core/digital-twins.js'));
const fixture = JSON.parse(execFileSync('python3', ['-c', `
import json,sys
from tools.seed_samples import seed_models,open_store
ids=seed_models(sys.argv[1]);store=open_store(sys.argv[1]);rid=ids['lift-fists']
print(json.dumps({'record':next(r for r in store.state()['records'] if r['id']==rid),'job':store.twin_index()['jobs'][rid]}))
`, join(output, 'samples')], {cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8'}));
const record = twinViewerRecord(fixture.record, fixture.job);

test('发布实体转换为独立描述，保持每面投影且无账本或照片序号', () => {
  const entity = toAlbumEntity(record);
  assert.equal(entity.schemaVersion, 1);
  assert.equal(entity.packaging.structure, 'gatefold');
  assert.equal(entity.packaging.discs, 2);
  for (const field of ['status', 'price', 'cost', 'artist', 'revision', 'photoCount', 'recordId', 'job'])
    assert.equal(Object.hasOwn(entity, field), false, field);
  assert.equal(entity.packaging.photos, undefined);
  for (const role of ['front', 'back', 'insideLeft', 'insideRight']) {
    assert.equal(entity.surfaces[role].origin, fixture.job.entity.surfaces[role].origin);
    assert.equal(entity.surfaces[role].sourceUrl, fixture.job.entity.surfaces[role].sourceUrl);
    assert.deepEqual(entity.surfaces[role].region, fixture.job.entity.surfaces[role].region);
    assert.equal(resolveAlbumAsset(record, entity.surfaces[role].asset), record.modelTextures[role]);
  }
  assert.deepEqual(entity.surfaces.insideRight.warpRows, fixture.job.entity.surfaces.insideRight.warpRows);
  assert.equal(resolveAlbumAsset(record, 'surface:absent'), '');
});

test('账目读回不改变实体描述，真实贴图变化只在宿主资源解析中生效', () => {
  assert.deepEqual(toAlbumEntity(record), toAlbumEntity({...record, revision: record.revision + 1, cost: '99.00', notes: 'changed'}));
  const changed = {...record, modelTextures: {...record.modelTextures, front: '/changed.png'}};
  assert.equal(resolveAlbumAsset(changed, toAlbumEntity(changed).surfaces.front.asset), '/changed.png');
});

test('旧包装保守解析，指定无效正面不能偷偷改用封面', () => {
  const legacy = {...fixture.record, version: '2CD Jewel Case', packaging: null, modelTextures: undefined};
  assert.equal(toAlbumEntity(legacy).packaging.structure, 'jewel');
  assert.equal(toAlbumEntity(legacy).packaging.thickness, 'standard');
  assert.equal(toAlbumEntity({...legacy, version: '紙ジャケット'}).packaging.structure, 'unknown');
  const missing = {...legacy, cover: '/cover.png', packaging: {photos: {front: 99}}};
  assert.equal(toAlbumEntity(missing).surfaces.front, undefined);
  assert.equal(resolveAlbumAsset(missing, 'surface:front'), '');
});
