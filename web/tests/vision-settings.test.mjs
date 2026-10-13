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

const output = mkdtempSync(join(tmpdir(), 'diedu-vision-settings-test-'));
const source = fileURLToPath(new URL('../src/', import.meta.url));
const program = ts.createProgram([join(source, 'components/VisionSettings.tsx')], {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  jsx: ts.JsxEmit.ReactJSX, strict: true, skipLibCheck: true, types: [],
  esModuleInterop: true, rootDir: source, outDir: output,
});
assert.equal(ts.getPreEmitDiagnostics(program).length, 0);
assert.equal(program.emit().emitSkipped, false);
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), join(output, 'node_modules'), 'dir');
const require = createRequire(import.meta.url);
const {VisionSettings} = require(join(output, 'components/VisionSettings.js'));
after(() => rmSync(output, {recursive: true, force: true}));

test('视觉模型设置默认折叠且不要求填写 API Key 才能录入条形码', () => {
  const markup = renderToStaticMarkup(createElement(VisionSettings));
  assert.match(markup, /<details class="settings-optional">/);
  assert.match(markup, /高级功能：AI 照片识别与数字实体生成/);
  assert.doesNotMatch(markup, /<form|服务地址<input|API 密钥<input/);
});
test('独立发行版查询的设置说明不再宣称 iTunes 是默认条码匹配入口', () => {
  const content = readFileSync(join(source, 'pages/SettingsPage.tsx'), 'utf8');
  assert.match(content, /<h3>发行资料自动匹配<\/h3>/);
  assert.match(content, /MusicBrainz 搜索 CD 发行版本/);
  assert.match(content, /无需配置 AI 模型或 API 密钥/);
  assert.match(content, /Cover Art Archive/);
  assert.doesNotMatch(content, /<h3>照片识别<\/h3>/);
});
test('原照片识别配置只作为高级设置且明确与条码搜索无关', () => {
  const sourceCode = readFileSync(join(source, 'components/VisionSettings.tsx'), 'utf8');
  assert.match(sourceCode, /if \(!expanded \|\| config\) return/);
  assert.match(sourceCode, /条形码匹配和 MusicBrainz \/ Cover Art Archive 查询不使用此配置/);
  assert.match(sourceCode, /仅影响照片识别，不影响条形码查询/);
});
