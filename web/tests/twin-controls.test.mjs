import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';

import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const {output, source, require} = compiledSources();
const {TwinControls} = require(join(output, 'components/TwinControls.js'));
const calibration = require('@diedu/album-engine/calibration');
const editor = require('@diedu/album-engine/editor');
const runtime = {...calibration, editionMaterialSources: editor.editionMaterialSources};
const {AppContext} = require(join(output, 'state/AppContext.js'));

const id = 'e618bce6-8e08-4628-9574-2d8f53b20db7';
const record = {id: 'copy', title: 'Islands', artist: 'King Crimson', version: 'Jewel Case', revision: 1,
  releaseInfo: {barcode: '4988013047105', musicBrainzReleaseId: id}};
function render(props = {}, configured = true, job = null, installed = true) {
  const app = {albumEngine: {runtime: installed ? runtime : null, status: {installed}}, twins: {jobs: job ? {copy: job} : {}, configured}, twinSyncError: ''};
  return renderToStaticMarkup(createElement(AppContext.Provider, {value: app},
    createElement(TwinControls, {record, releaseId: id, ...props})));
}
function button(markup, label) {
  const found = [...markup.matchAll(/<button([^>]*)>(.*?)<\/button>/g)]
    .find(([, , contents]) => contents === label);
  assert.ok(found, 'button exists: ' + label);
  return found[1];
}
const succeeded = {id: 'job', status: 'succeeded', releaseId: id,
  entity: {packaging: {structure: 'gatefold', panels: 2, holder: 'pocket', pockets: 'both', pocketOpening: 'inner', discs: 2},
    surfaces: {disc: {asset: 'photo-0.png'}}, warnings: [],
    calibration: {spine: {widthRatio: .001, basis: 'image-estimate', asset: 'photo-0.jpg', origin: 'edition-reference', sourceUrl: ''}}}};

test('数字实体的生成已交给 Album Engine 项目：宿主里没有任何生成、选图或取消入口', () => {
  for (const html of [render(), render({}, false), render({}, true, {id: 'job', status: 'failed', error: '图集暂不可用'}),
    render({}, true, {id: 'job', status: 'running', message: '处理中'}), render({}, true, succeeded)]) {
    assert.doesNotMatch(html, /生成数字实体|重新生成|人工选图|取消任务|AI 生成|视觉模型|<input|<select/);
  }
});
test('没有实体时只说明由引擎项目生成；有任务在处理时只读展示状态', () => {
  assert.match(render(), /还没有数字实体/);
  const running = render({}, true, {id: 'job', status: 'running', message: '处理中'});
  assert.match(running, /处理中/);
  assert.doesNotMatch(running, /<button/);
});
test('成功实体沿用已保存版本，估计尺寸不会冒充实测', () => {
  const html = render({}, true, succeeded);
  assert.match(html, /已有数字实体/);
  assert.match(html, /并非实测尺寸/);
  assert.match(html, /补充或移除独立附件/);
});
test('历史已发布实体缺少可选说明时仍能在编辑中校准盘面', () => {
  const job = {id: 'job', status: 'succeeded', releaseId: id, entity: {packaging: {structure: 'jewel'}, surfaces: {disc: {asset: 'photo-0.png'}}}};
  const html = render({}, true, job);
  assert.match(html, /已有数字实体/);
  assert.doesNotMatch(button(html, '校准盘面'), /disabled/);
});
test('未保存或副本过期时，附件与校准编辑被禁用', () => {
  for (const props of [{unsaved: true}, {saving: true}, {stale: true}]) {
    const html = render(props, true, succeeded);
    assert.match(button(html, '补充或移除独立附件'), /disabled/);
    assert.match(button(html, '校准盘面'), /disabled/);
  }
});
test('插件缺席时保留历史任务，只提供安装入口，不发送校准操作', () => {
  const html = render({}, true, {id: 'saved-job', status: 'succeeded', releaseId: id}, false);
  assert.match(html, /安装 Album Engine/);
  assert.match(html, /已有实体资料与素材已保留/);
  assert.match(html, /data-task-id="saved-job"/);
  // 抽屉里的「打开设置」必须先收起抽屉再跳转：直接用 <a href="#settings"> 只会改 hash，抽屉仍盖在页面上
  assert.match(html, /<button[^>]*>打开设置<\/button>/);
  assert.doesNotMatch(html, /href="#settings"/);
  assert.doesNotMatch(html, /校准盘面|album-engine-mount|补充或移除独立附件/);
});

test('数字实体入口在展示灯箱里（实体设置），不在编辑表单，也不在管理页（D-015）', () => {
  const read = file => readFileSync(join(source, file), 'utf8');
  const form = ['forms/RecordForm.tsx', ...readdirSync(join(source, 'forms/record')).map(f => 'forms/record/' + f)].map(read).join('\n');
  assert.doesNotMatch(form, /TwinControls|数字实体/);
  assert.doesNotMatch(['forms/DetailDrawer.tsx', ...readdirSync(join(source, 'forms/detail')).map(f => 'forms/detail/' + f)].map(read).join('\n'),
    /TwinControls|数字实体/);
  const focus = read('components/GalleryFocus.tsx');
  assert.match(focus, /<TwinControls record=\{record\}/);
  assert.match(focus, /实体设置/);
  // 灯箱是 top-layer dialog：引擎未安装时「打开设置」必须由灯箱自己跳转，而不是走抽屉的 closeDrawerAndGo
  assert.match(focus, /onSettings=\{\(\) => \{location\.hash = '#settings';\}\}/);
});

test('返回上一层是弹栈而不是重新打开：二级页 / 艺人页的返回按钮不再调用 openDetail / openArtistDrawer', () => {
  const read = file => readFileSync(join(source, file), 'utf8');
  // 回归：返回原来是「再 openDetail 一次」，详情页被重新创建，爱心 / 照片预取 / 封面全部重新加载，看起来闪一下
  for (const file of ['forms/detail/ReleasePage.tsx', 'forms/detail/ManagePage.tsx']) {
    const src = read(file);
    assert.match(src, /app\.backDrawer\(\)/, file + ' 返回应弹栈');
    assert.doesNotMatch(src, /openDetail\(/, file + ' 不应重新打开详情');
  }
  assert.match(read('forms/ArtistDrawer.tsx'), /run: \(\) => \{ app\.backDrawer\(\); \}/);
  // Drawer 以稳定 id 作 key 让栈里每层常驻（不销毁重建）
  const drawer = read('components/ui/Drawer.tsx');
  assert.match(drawer, /key=\{layer\.id\}/);
  assert.match(drawer, /is-covered/);
});
