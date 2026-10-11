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

const record = {id: 'islands-copy', title: 'Islands', artist: 'King Crimson', revision: 1, photoCount: 0};
const candidate = {
  id: 'e618bce6-8e08-4628-9574-2d8f53b20db7', title: 'Islands', artist: 'King Crimson',
  barcode: '4988013047105', country: 'JP', date: '2000-03-01', label: 'Discipline Global Mobile',
  catalogNumber: 'PCCY-01424', discCount: 1, media: [{position: 1, format: 'CD', tracks: [{position: 1, title: 'Formentera Lady'}]}],
  url: 'https://musicbrainz.org/release/e618bce6-8e08-4628-9574-2d8f53b20db7',
  artworkStatus: 'available', artwork: [{id: 'gold-disc', types: ['Medium'], comment: '', previewUrl: '/api/twin-review-assets/review/preview-disc.jpg'}],
};
const review = {id: 'review', status: 'needs_input', phase: 'awaiting_confirmation', barcode: candidate.barcode,
  barcodeSource: 'manual', candidates: [candidate]};
function render(job, props = {}, configured = false) {
  return renderToStaticMarkup(createElement(AppContext.Provider, {value: {twins: {jobs: job ? {[record.id]: job} : {}, configured}, twinSyncError: ''}},
    createElement(TwinControls, {record, onAddPhoto() {}, ...props})));
}
function button(markup, label) {
  const found = Array.from(markup.matchAll(/<button([^>]*)>(.*?)<\/button>/g)).find(([, , text]) => text === label);
  assert.ok(found, 'button exists: ' + label);
  return found[1];
}

test('未配置生成模型仍可手工查询条形码；实物照片入口优先读取照片，不要求发行链接和还原要求', () => {
  const manual = render();
  assert.match(manual, /实物条形码号/);
  assert.doesNotMatch(manual, /还原要求|发行版链接|textarea/);
  const photo = render(undefined, {record: {...record, photoCount: 1}});
  assert.doesNotMatch(button(photo, '识别实物条形码并匹配版本'), /disabled/);
  assert.match(photo, /输入条形码号/);
});

test('单一条码结果仍展示实物资料和显式确认；未收录包装保持未知，受保护图集不冒充完整实物', () => {
  const markup = render(review);
  for (const value of ['Islands', 'King Crimson', '4988013047105', 'PCCY-01424', '2000-03-01', 'Formentera Lady']) assert.ok(markup.includes(value));
  assert.match(markup, /未收录，请以实物为准/);
  assert.match(markup, /缺少的背面、书脊或收纳结构/);
  assert.match(markup, /src="\/api\/twin-review-assets\/review\/preview-disc.jpg"/);
  assert.match(button(markup, '确认此版本并生成数字实体'), /disabled/);
  assert.match(markup, /配置视觉模型/);
});

test('未保存修改禁止按旧资料查询或确认，添加背面照片保留入口；等待条码能继续手工填写', () => {
  const dirty = render(undefined, {unsaved: true});
  assert.match(button(dirty, '匹配条形码对应的发行版本'), /disabled/);
  assert.doesNotMatch(button(dirty, '添加背面照片'), /disabled/);
  assert.match(dirty, /当前输入和照片仍保留/);
  assert.match(button(render(review, {unsaved: true}, true), '确认此版本并生成数字实体'), /disabled/);
  const waiting = render({...review, phase: 'awaiting_barcode', candidates: []}, {record: {...record, photoCount: 2}});
  assert.match(waiting, /未找到清晰可读的条形码/);
  assert.match(waiting, /实物条形码号/);
});

test('外部保存导致编辑快照过期时保持当前输入，禁止静默使用刷新后的副本查询或生成', () => {
  const markup = render(review, {stale: true}, true);
  assert.match(markup, /副本已在其他窗口更新/);
  assert.match(markup, /关闭并重新打开编辑/);
  assert.match(button(markup, '确认此版本并生成数字实体'), /disabled/);
  assert.match(button(markup, '重新匹配发行版本'), /disabled/);
});

test('未尝试加载的图片不误报为来源不可用，旧任务无预览状态时保持中性提示', () => {
  const artwork = [
    {id: 'deferred', types: ['Booklet'], comment: '', previewStatus: 'not_loaded'},
    {id: 'failed', types: ['Booklet'], comment: '', previewStatus: 'unavailable'},
    {id: 'legacy', types: ['Booklet'], comment: ''},
  ];
  const markup = render({...review, candidates: [{...candidate, artwork}]});
  assert.equal(markup.match(/>未加载预览</g)?.length, 2);
  assert.equal(markup.match(/>预览暂不可用</g)?.length, 1);
});
