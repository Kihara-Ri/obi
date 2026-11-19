import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';

import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const {output, source, require} = compiledSources();
const zoom = require(join(output, 'core/gallery-zoom.js'));

test('缩略图过渡按元素中心等比缩放，裁切圆角换算回缩放前尺寸', () => {
  const full = {left: 100, top: 50, width: 400, height: 600};
  const thumb = {left: 20, top: 30, width: 100, height: 150};
  const [start, end] = zoom.thumbnailZoomFrames(full, thumb, 8, '12px');
  assert.deepEqual(start, {transform: 'translate(-230px, -245px) scale(0.25)', clipPath: 'inset(0px 0px round 32px)'});
  assert.deepEqual(end, {transform: 'none', clipPath: 'inset(0px 0px round 12px)'});
});

test('横图收回方形缩略图：等比铺满不变形，左右多出的部分裁掉，落点圆角等于缩略图圆角', () => {
  const full = {left: 0, top: 200, width: 400, height: 300};
  const thumb = {left: 20, top: 540, width: 72, height: 72};
  const [frame] = zoom.thumbnailZoomFrames(full, thumb, 9, '12px');
  // 铺满方块取纵向比例 72/300 = 0.24；可见宽 72/0.24 = 300，左右各裁 50
  assert.deepEqual(frame, {transform: 'translate(-144px, 226px) scale(0.24)', clipPath: 'inset(0px 50px round 37.5px)'});
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
