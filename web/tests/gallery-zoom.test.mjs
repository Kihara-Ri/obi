import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const output = mkdtempSync(join(tmpdir(), 'diedu-gallery-zoom-'));
let zoom;
try {
  const source = fileURLToPath(new URL('../src/core/gallery-zoom.ts', import.meta.url));
  const program = ts.createProgram([source], {target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS, strict: true, skipLibCheck: true, types: [], outDir: output});
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => output, getCanonicalFileName: name => name, getNewLine: () => '\n',
  }));
  assert.equal(program.emit().emitSkipped, false);
  writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
  zoom = createRequire(import.meta.url)(join(output, 'gallery-zoom.js'));
} catch (error) {rmSync(output, {recursive: true, force: true}); throw error;}
after(() => rmSync(output, {recursive: true, force: true}));

test('缩略图过渡按元素中心与实际宽高计算，并按横向缩放修正角半径', () => {
  const full = {left: 100, top: 50, width: 400, height: 600};
  const thumb = {left: 20, top: 30, width: 100, height: 150};
  const [start, end] = zoom.thumbnailZoomFrames(full, thumb, 8, '12px');
  assert.deepEqual(start, {transform: 'translate(-230px, -245px) scale(0.25, 0.25)', borderRadius: '32px'});
  assert.deepEqual(end, {transform: 'none', borderRadius: '12px'});
});

test('非等比缩略图使用独立宽高缩放，反向动画可复用起始关键帧', () => {
  const full = {left: 10, top: 20, width: 300, height: 500};
  const thumb = {left: 170, top: 80, width: 120, height: 60};
  const [thumbnailFrame] = zoom.thumbnailZoomFrames(full, thumb, 6, '0px');
  assert.deepEqual(thumbnailFrame, {transform: 'translate(70px, -160px) scale(0.4, 0.12)', borderRadius: '15px'});
});

test('遮罩动画取消后仍保留目标透明度，避免收起中途闪回不透明底色', () => {
  const style = {opacity: '1'};
  let opacityAtCancel = '';
  zoom.commitAnimationOpacity(style, 0, () => {opacityAtCancel = style.opacity;});
  assert.equal(opacityAtCancel, '0');
  assert.equal(style.opacity, '0');
});

test('竖版封面：缩略图和大图的可见像素矩形均保留原始宽高比', () => {
  const aspect = 2 / 3;
  const small = zoom.containedImageRect({left: 100, top: 200, width: 180, height: 180}, aspect);
  const large = zoom.containedImageRect({left: 200, top: 40, width: 1000, height: 680}, aspect);
  assert.deepEqual(small, {left: 130, top: 200, width: 120, height: 180});
  assert.ok(Math.abs(large.width / large.height - aspect) < 1e-9);
  assert.equal(large.height, 680);
  const [from, to] = zoom.coverRectFrames(small, large);
  assert.equal(from.left, '130px');
  assert.equal(from.width, '120px');
  assert.equal(to.height, '680px');
  assert.equal(to.width, `${680 * aspect}px`);
});

test('横版和方形封面适配容器时不被强制拉伸', () => {
  const box = {left: 50, top: 70, width: 600, height: 360};
  assert.deepEqual(zoom.containedImageRect(box, 2),
    {left: 50, top: 100, width: 600, height: 300});
  assert.deepEqual(zoom.containedImageRect(box, 1),
    {left: 170, top: 70, width: 360, height: 360});
});

test('未加载图片比例或无尺寸时安全回退，不生成无穷或 NaN 坐标', () => {
  const box = {left: 5, top: 7, width: 200, height: 0};
  assert.deepEqual(zoom.containedImageRect(box, 0), box);
  assert.deepEqual(zoom.containedImageRect(box, Number.NaN), box);
  assert.deepEqual(zoom.containedImageRect(box, 0.75), box);
});
