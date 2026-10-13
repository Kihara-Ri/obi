import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {mkdtempSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const output = mkdtempSync(join(tmpdir(), 'diedu-twin-controls-test-'));
const source = fileURLToPath(new URL('../src/', import.meta.url));
const program = ts.createProgram([join(source, 'components/TwinControls.tsx')], {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  strict: true, skipLibCheck: true, types: [], esModuleInterop: true, rootDir: source, outDir: output,
});
assert.equal(ts.getPreEmitDiagnostics(program).length, 0);
assert.equal(program.emit().emitSkipped, false);
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), join(output, 'node_modules'), 'dir');
const require = createRequire(import.meta.url);
const {TwinControls} = require(join(output, 'components/TwinControls.js'));
const {AppContext} = require(join(output, 'state/AppContext.js'));
after(() => rmSync(output, {recursive: true, force: true}));

const id = 'e618bce6-8e08-4628-9574-2d8f53b20db7';
const record = {id: 'copy', title: 'Islands', artist: 'King Crimson', version: 'Jewel Case', revision: 1,
  releaseInfo: {barcode: '4988013047105', musicBrainzReleaseId: id}};
function render(props = {}, configured = true, job = null) {
  const app = {twins: {jobs: job ? {copy: job} : {}, configured}, twinSyncError: ''};
  return renderToStaticMarkup(createElement(AppContext.Provider, {value: app},
    createElement(TwinControls, {record, releaseId: id, ...props})));
}
function button(markup, label) {
  const found = [...markup.matchAll(/<button([^>]*)>(.*?)<\/button>/g)]
    .find(([, , contents]) => contents === label);
  assert.ok(found, 'button exists: ' + label);
  return found[1];
}

test('只使用上方已保存的发行版编号；不再有第二组条形码、背面照片与选版', () => {
  const html = render();
  assert.match(html, /已绑定 MusicBrainz 发行版/);
  assert.doesNotMatch(html, /<input|添加背面照片|输入条形码|确认此版本并生成/);
  assert.doesNotMatch(button(html, '生成数字实体'), /disabled/);
});
test('必须先保存发行版，并已配置模型才能生成', () => {
  assert.match(button(render({releaseId: ''}), '生成数字实体'), /disabled/);
  assert.match(button(render({unsaved: true}), '生成数字实体'), /disabled/);
  assert.match(button(render({stale: true}), '生成数字实体'), /disabled/);
  assert.match(button(render({}, false), '生成数字实体'), /disabled/);
  assert.match(render({}, false), /图集预览无需模型/);
});
test('失败任务可重试，后台生成任务可取消，不重复选择发行版', () => {
  const failed = render({}, true, {id: 'job', status: 'failed', error: '图集暂不可用'});
  assert.doesNotMatch(button(failed, '重新生成数字实体'), /disabled/);
  assert.match(failed, /图集暂不可用/);
  const running = render({}, true, {id: 'job', status: 'running', message: '生成中'});
  assert.match(button(running, '取消任务'), /type="button"/);
  assert.doesNotMatch(running, /重新匹配发行版本/);
});
test('成功实体沿用已保存版本，估计尺寸不会冒充实测', () => {
  const job = {id: 'job', status: 'succeeded', releaseId: id,
    entity: {packaging: {structure: 'gatefold', panels: 2, holder: 'pocket',
      pockets: 'both', pocketOpening: 'inner', discs: 2}, surfaces: {}, warnings: [],
      calibration: {spine: {widthRatio: .001, basis: 'image-estimate', asset: 'photo-0.jpg',
        origin: 'edition-reference', sourceUrl: ''}}}};
  const html = render({}, true, job);
  assert.match(html, /数字实体已生成/);
  assert.match(html, /并非实测尺寸/);
  assert.doesNotMatch(html, /生成数字实体<\/button>/);
});
