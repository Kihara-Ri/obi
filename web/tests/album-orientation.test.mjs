import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const output = mkdtempSync(join(tmpdir(), 'diedu-album-orientation-'));
let orientation;
try {
  const source = fileURLToPath(new URL('../src/core/album-orientation.ts', import.meta.url));
  const program = ts.createProgram([source], {target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS, strict: true, skipLibCheck: true, types: [], outDir: output});
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => output, getCanonicalFileName: name => name, getNewLine: () => '\n',
  }));
  assert.equal(program.emit().emitSkipped, false);
  writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
  orientation = createRequire(import.meta.url)(join(output, 'album-orientation.js'));
} catch (error) {rmSync(output, {recursive: true, force: true}); throw error;}
after(() => rmSync(output, {recursive: true, force: true}));

function near(actual, expected) {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-10, `${actual.x} vs ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < 1e-10, `${actual.y} vs ${expected.y}`);
}

test('任一感应轴缺失或无效时不把手机误置为零度', () => {
  for (const invalid of [null, undefined, NaN, Infinity, -Infinity]) {
    assert.equal(orientation.albumOrientationReading(invalid, 0), null);
    assert.equal(orientation.albumOrientationReading(0, invalid), null);
  }
  assert.deepEqual(orientation.albumOrientationReading(0, 0), {beta: 0, gamma: 0});
});

test('以用户拿起手机的姿态为中性角，只输出相对的有界倾斜', () => {
  const neutral = {beta: 74, gamma: 12};
  near(orientation.albumOrientationTilt(neutral, neutral), {x: 0, y: 0});
  near(orientation.albumOrientationTilt({beta: 79, gamma: 9}, neutral), {x: -5, y: -3});
  near(orientation.albumOrientationTilt({beta: 130, gamma: -50}, neutral), {x: -18, y: -18});
  near(orientation.albumOrientationTilt({beta: 15, gamma: 70}, neutral), {x: 18, y: 18});
});

test('beta 穿越正负 180 度和 gamma 的等价欧拉分支时不跳转', () => {
  near(orientation.albumOrientationTilt({beta: -179, gamma: 0}, {beta: 179, gamma: 0}), {x: -2, y: 0});
  near(orientation.albumOrientationTilt({beta: 179, gamma: 0}, {beta: -179, gamma: 0}), {x: 2, y: 0});
  near(orientation.albumOrientationTilt({beta: 160, gamma: -89}, {beta: 20, gamma: 89}), {x: 0, y: 2});
  near(orientation.albumOrientationTilt({beta: 160, gamma: 89}, {beta: 20, gamma: -89}), {x: 0, y: -2});
  // Moving from +89° to −89° without the corresponding beta branch change is
  // a large physical yaw change, not a small crossing to wrap away.
  near(orientation.albumOrientationTilt({beta: 0, gamma: -89}, {beta: 0, gamma: 89}), {x: 0, y: -18});
});

test('横屏及倒置屏幕的倾斜沿屏幕方向映射，左右横屏不反向错轴', () => {
  const neutral = {beta: 0, gamma: 0}, reading = {beta: 5, gamma: 3};
  near(orientation.albumOrientationTilt(reading, neutral, 0), {x: -5, y: 3});
  near(orientation.albumOrientationTilt(reading, neutral, 90), {x: -3, y: -5});
  near(orientation.albumOrientationTilt(reading, neutral, -90), {x: 3, y: 5});
  near(orientation.albumOrientationTilt(reading, neutral, 180), {x: 5, y: -3});
  near(orientation.albumOrientationTilt(reading, neutral, 270), {x: 3, y: 5});
});
