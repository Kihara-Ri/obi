import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const output = mkdtempSync(join(tmpdir(), 'diedu-roaming-switch-test-'));
const source = fileURLToPath(new URL('../src/', import.meta.url));
const program = ts.createProgram([join(source, 'components/GalleryRoamingControls.tsx')], {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  jsx: ts.JsxEmit.ReactJSX, strict: true, skipLibCheck: true, types: [],
  esModuleInterop: true, rootDir: source, outDir: output,
});
assert.equal(ts.getPreEmitDiagnostics(program).length, 0);
assert.equal(program.emit().emitSkipped, false);
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), join(output, 'node_modules'), 'dir');
const require = createRequire(import.meta.url);
const {GalleryRoamingSwitch} = require(join(output, 'components/GalleryRoamingControls.js'));
after(() => rmSync(output, {recursive: true, force: true}));

const render = (enabled, disabled = false) =>
  renderToStaticMarkup(createElement(GalleryRoamingSwitch, {enabled, disabled, onToggle() {}}));

test('漫游文字仅作为静态说明，switch 按钮只包住右侧轨道', () => {
  const markup = render(true);
  assert.match(markup, /<div class="gallery-roaming-switch" data-enabled="true">/);
  assert.match(markup, /<span class="gallery-roaming-switch-label">漫游<\/span><button /);
  const button = markup.match(/<button [^>]+>(.*?)<\/button>/);
  assert.ok(button);
  assert.match(button[0], /role="switch"/);
  assert.match(button[0], /aria-label="自动漫游"/);
  assert.match(button[0], /aria-checked="true"/);
  assert.doesNotMatch(button[1], /漫游/);
  assert.match(button[1], /gallery-roaming-switch-track/);
});
test('开关关闭与禁用不扩大触控区域，也保持 switch 语义', () => {
  const markup = render(false, true);
  assert.match(markup, /data-enabled="false"/);
  assert.match(markup, /role="switch" aria-label="自动漫游" aria-checked="false" disabled=""/);
  assert.equal((markup.match(/<button /g) || []).length, 1);
});
test('按下时不会继承全局按钮的 translateY 位移', () => {
  const styles = readFileSync(join(source, 'styles/gallery-roaming.css'), 'utf8');
  assert.match(styles, /\.gallery-roaming-switch-button:active\{transform:none\}/);
  assert.match(styles, /\.gallery-roaming-switch-button\{[^}]*transition:none;transform:none/);
  assert.match(styles, /\.gallery-roaming-switch-label\{cursor:default/);
});
