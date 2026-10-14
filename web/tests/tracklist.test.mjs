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

const output = mkdtempSync(join(tmpdir(), 'diedu-tracklist-test-'));
const source = fileURLToPath(new URL('../src/', import.meta.url));
const program = ts.createProgram([join(source, 'components/Tracklist.tsx')], {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  jsx: ts.JsxEmit.ReactJSX, strict: true, skipLibCheck: true, types: [],
  esModuleInterop: true, rootDir: source, outDir: output,
});
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCurrentDirectory: () => source, getCanonicalFileName: name => name, getNewLine: () => '\n',
}));
assert.equal(program.emit().emitSkipped, false);
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), join(output, 'node_modules'), 'dir');
const require = createRequire(import.meta.url);
const {trackDiscs, trackDuration} = require(join(output, 'core/tracklist.js'));
const {Tracklist} = require(join(output, 'components/Tracklist.js'));
after(() => rmSync(output, {recursive: true, force: true}));
const render = info => renderToStaticMarkup(createElement(Tracklist, {releaseInfo: info}));

test('旧 1-1 / 2-1 字符串按实体 CD 分碟，不污染曲名', () => {
  const info = {tracklist: ['1-1 Shine On You Crazy Diamond', '1-2 Twenty-One',
    '2-1 Time', '2-2 Wish You Were Here']};
  const discs = trackDiscs(info);
  assert.deepEqual(discs.map(d => [d.position, d.tracks.length]), [[1, 2], [2, 2]]);
  assert.equal(discs[0].tracks[1].title, 'Twenty-One');
  const html = render(info);
  assert.match(html, /曲目 <span>· 4 首 · 2 碟/);
  assert.match(html, /CD 1/);
  assert.match(html, /CD 2/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /全部收起/);
  assert.doesNotMatch(html, /1-1 Shine/);
  assert.doesNotMatch(html, /2-2 Wish/);
});

test('MusicBrainz media 优先于扁平字符串，保留介质名称、类型和曲目时长', () => {
  const info = {tracklist: ['1-1 旧内容'], media: [
    {position: 1, format: 'CD', title: 'Studio', tracks: [
      {position: 1, title: 'New Song', lengthMs: 245000}]},
    {position: 2, format: 'DVD', title: 'Concert', tracks: [
      {position: 1, title: 'Live', lengthMs: 3723000}]},
  ]};
  const html = render(info);
  assert.match(html, /Studio/);
  assert.match(html, /DVD 2/);
  assert.match(html, /Concert/);
  assert.match(html, /4:05/);
  assert.match(html, /62:03/);
  assert.doesNotMatch(html, /旧内容/);
});

test('单 CD 不显示折叠控件，多碟保持独立开关', () => {
  const solo = render({tracklist: ['1-1 Only Track', '1-2 Another Track']});
  assert.match(solo, /曲目 <span>· 2 首/);
  assert.doesNotMatch(solo, /CD 1|aria-expanded|全部展开|全部收起/);
  assert.match(solo, /record-track-single/);
  assert.equal((render({tracklist: ['1-1 A','2-1 B']}).match(/aria-expanded="true"/g) || []).length, 2);
});

test('曲目较多的套装默认先展开第一碟，允许后续逐碟展开', () => {
  const info = {tracklist: ['1-1 A','2-1 B','3-1 C','4-1 D']};
  const html = render(info);
  assert.equal((html.match(/aria-expanded="true"/g) || []).length, 1);
  assert.equal((html.match(/aria-expanded="false"/g) || []).length, 3);
  assert.match(html, /全部展开/);
});

test('无序号的历史曲目保留，不臆造时长或其它碟', () => {
  const discs = trackDiscs({tracklist:['One','Two-Three','Four']});
  assert.equal(discs.length, 1);
  assert.deepEqual(discs[0].tracks.map(t => t.title), ['One','Two-Three','Four']);
  assert.equal(trackDuration(undefined), null);
  assert.equal(trackDuration(0), null);
  assert.equal(trackDuration(64000), '1:04');
});
