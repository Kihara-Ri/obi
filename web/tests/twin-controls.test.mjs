import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';

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
  assert.match(html, /href="#settings"/);
  assert.doesNotMatch(html, /<button|校准盘面|album-engine-mount/);
});
