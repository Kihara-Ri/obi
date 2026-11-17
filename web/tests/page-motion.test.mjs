import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';

const {output, require} = compiledSources();
const {pageMotion, mobileTabOrder, rootOf} = require(join(output, 'core/page-motion.js'));

const ALL = {acquisition: true, trading: true, circulation: true, showcase: true};
const manage = mobileTabOrder(ALL, false);
const show = mobileTabOrder(ALL, true);

test('底栏顺序随首页与模块变化，「更多」总在最后', () => {
  assert.deepEqual(manage, ['domestic', 'transit', 'shipping', 'more']);
  assert.deepEqual(show, ['gallery', 'domestic', 'transit', 'shipping', 'more']);
  assert.deepEqual(mobileTabOrder({acquisition: false, trading: false, circulation: false, showcase: true}, true), ['gallery', 'domestic', 'more']);
});

test('底栏之间按图标左右位置定方向', () => {
  assert.deepEqual(pageMotion('domestic', 'transit', manage, false), {kind: 'tab', dir: 1});
  assert.deepEqual(pageMotion('shipping', 'transit', manage, false), {kind: 'tab', dir: -1});
  assert.deepEqual(pageMotion('more', 'domestic', manage, false), {kind: 'tab', dir: -1});
  // 海外库存算在「库存」标签上
  assert.deepEqual(pageMotion('overseas', 'transit', manage, false), {kind: 'tab', dir: 1});
  // 以展示为主：展示在库存左边
  assert.deepEqual(pageMotion('domestic', 'gallery', show, true), {kind: 'tab', dir: -1});
  assert.deepEqual(pageMotion('gallery', 'transit', show, true), {kind: 'tab', dir: 1});
});

test('「更多」里进一层是推入，退一层是弹出', () => {
  assert.deepEqual(pageMotion('more', 'settings', manage, false), {kind: 'push'});
  assert.deepEqual(pageMotion('settings', 'trash', manage, false), {kind: 'push'});
  assert.deepEqual(pageMotion('trash', 'settings', manage, false), {kind: 'pop'});
  assert.deepEqual(pageMotion('lookup', 'more', manage, false), {kind: 'pop'});
  // 回收站里点底栏「更多」：直接回到这一列的顶层
  assert.deepEqual(pageMotion('trash', 'more', manage, false), {kind: 'pop'});
  assert.equal(rootOf('trash'), 'more');
});

test('子页里点别的底栏标签按「更多」的位置横向切换', () => {
  assert.deepEqual(pageMotion('settings', 'transit', manage, false), {kind: 'tab', dir: -1});
  assert.deepEqual(pageMotion('trash', 'gallery', show, true), {kind: 'tab', dir: -1});
});

test('国内↔海外不换页；以管理为主时库存↔展示交给顶栏切换', () => {
  assert.deepEqual(pageMotion('domestic', 'overseas', manage, false), {kind: 'none'});
  assert.deepEqual(pageMotion('domestic', 'gallery', manage, false), {kind: 'switch'});
  assert.deepEqual(pageMotion('gallery', 'overseas', manage, false), {kind: 'switch'});
  assert.deepEqual(pageMotion('', 'domestic', manage, false), {kind: 'none'});
});
