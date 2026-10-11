import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const output = mkdtempSync(join(tmpdir(), 'diedu-photo-projection-test-'));
const source = fileURLToPath(new URL('../src/', import.meta.url));
let photoProjection;
try {
  const program = ts.createProgram([join(source, 'core/album-photo-projection.ts')], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, strict: true,
    skipLibCheck: true, types: [], rootDir: source, outDir: output,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => source, getCanonicalFileName: name => name, getNewLine: () => '\n',
  }));
  assert.equal(program.emit().emitSkipped, false);
  writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
  ({photoProjection} = createRequire(import.meta.url)(join(output, 'core/album-photo-projection.js')));
} catch (error) {rmSync(output, {recursive: true, force: true}); throw error;}
after(() => rmSync(output, {recursive: true, force: true}));

function close(actual, expected, message) {
  assert.ok(Number.isFinite(actual), `${message}: finite coordinate`);
  assert.ok(Math.abs(actual - expected) < 1e-10, `${message}: ${actual} != ${expected}`);
}

// The public contract is a row-major matrix acting on the column [u, v, 1].
function projected(matrix, u, v) {
  const divisor = matrix[6] * u + matrix[7] * v + matrix[8];
  assert.ok(Number.isFinite(divisor) && Math.abs(divisor) > 1e-12, 'finite perspective division');
  return [(matrix[0] * u + matrix[1] * v + matrix[2]) / divisor,
    (matrix[3] * u + matrix[4] * v + matrix[5]) / divisor];
}

function pointClose(actual, expected, message) {
  actual.forEach((coordinate, index) => close(coordinate, expected[index], `${message}[${index}]`));
}

const planeCorners = [[0, 0], [1, 0], [1, 1], [0, 1]];

// An independently specified projective camera, not a reconstruction of the solver.
// Its nonconstant denominator is 1 + u/5 + v/10.
const knownProjection = [2 / 5, 1 / 10, 3 / 20, 1 / 20, 9 / 20, 1 / 5, 1 / 5, 1 / 10, 1];
const knownCorners = Object.freeze([3 / 20, 1 / 5, 11 / 24, 5 / 24, 1 / 2, 7 / 13, 5 / 22, 13 / 22]);

test('四角保持照片左上原点，按 TL/TR/BR/BL 精确对应，不翻转或转置', () => {
  for (const region of [[0, 0, 1, 0, 1, 1, 0, 1],
    [.1, .2, .8, .2, .8, .9, .1, .9],
    [.08, .12, .85, .21, .74, .93, .18, .8]]) {
    const frozen = Object.freeze(region);
    const matrix = photoProjection(frozen);
    assert.ok(matrix, 'a convex printed quadrilateral has a projection');
    assert.equal(matrix.length, 9);
    planeCorners.forEach(([u, v], index) =>
      pointClose(projected(matrix, u, v), region.slice(index * 2, index * 2 + 2), `corner ${index}`));
    assert.deepEqual(frozen, region);
  }
});

test('可解析的非仿射照片恢复已知投影，并将内部点映射到独立算得的分数坐标', () => {
  const matrix = photoProjection(knownCorners);
  assert.ok(matrix);
  matrix.forEach((value, index) => close(value, knownProjection[index], `coefficient ${index}`));
  for (const [uv, photoPoint] of [[[1 / 4, 3 / 4], [13 / 45, 22 / 45]],
    [[3 / 4, 1 / 4], [19 / 47, 14 / 47]], [[1 / 2, 1 / 2], [8 / 23, 9 / 23]]])
    pointClose(projected(matrix, ...uv), photoPoint, `interior ${uv}`);
});

test('印刷面两个三角形共用同一矩阵，对角线全程连续而非逐顶点线性裁图', () => {
  const matrix = photoProjection(knownCorners);
  assert.ok(matrix);
  const [tl, tr, br, bl] = planeCorners;
  const interpolate = (vertices, weights) => [0, 1].map(axis =>
    vertices.reduce((sum, vertex, index) => sum + vertex[axis] * weights[index], 0));
  for (const t of [0, .07, .25, .5, .73, .96, 1]) {
    const first = interpolate([tl, tr, br], [1 - t, 0, t]);
    const second = interpolate([tl, br, bl], [1 - t, t, 0]);
    const expected = projected(knownProjection, t, t);
    pointClose(projected(matrix, ...first), expected, `first triangle at ${t}`);
    pointClose(projected(matrix, ...second), expected, `second triangle at ${t}`);
  }
  const center = projected(matrix, .5, .5);
  const linearCenter = [0, 1].map(axis => (knownCorners[axis] + knownCorners[4 + axis]) / 2);
  assert.ok(Math.hypot(center[0] - linearCenter[0], center[1] - linearCenter[1]) > .01,
    'perspective mapping at a fragment differs from linear interpolation of projected corner UVs');
});

test('不完整、非有限或越界的照片区域返回 null', () => {
  for (const region of [[], [0, 0, 1, 0, 1, 1], [0, 0, 1, 0, 1, 1, 0, 1, .5]])
    assert.equal(photoProjection(region), null, `wrong coordinate count: ${region.length}`);
  for (const invalid of [NaN, Infinity, -Infinity, -.001, 1.001, '0']) {
    const region = [0, 0, 1, 0, 1, 1, 0, 1];
    region[3] = invalid;
    assert.equal(photoProjection(region), null, `invalid coordinate: ${String(invalid)}`);
  }
});

test('重复角点、共线或任意一组三点共线的退化区域返回 null', () => {
  for (const region of [[.5, .5, .5, .5, .5, .5, .5, .5],
    [0, .5, .25, .5, .75, .5, 1, .5],
    [0, 0, 1, 0, 1, 0, 0, 1],
    [0, 0, .5, 0, 1, 0, 0, 1],
    [0, 0, 1, 0, 1, .5, 1, 1],
    [0, 0, 1, 0, 1, 1, .5, .5],
    [0, 0, 1, 0, 1, 1, .5, 0]]) {
    assert.equal(photoProjection(region), null, `degenerate quadrilateral: ${region}`);
  }
});

test('交叉或内凹区域不产生在印刷面内部穿过无穷远的投影', () => {
  for (const region of [[0, 0, 1, 1, 1, 0, 0, 1], [0, 0, 1, 0, .2, .2, 0, 1]])
    assert.equal(photoProjection(region), null, `a printed plane cannot project onto ${region}`);
});
