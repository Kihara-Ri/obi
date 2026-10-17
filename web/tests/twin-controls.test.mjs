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

test('只使用上方已保存的发行版编号；不再有第二组条形码、背面照片与选版', () => {
  const html = render();
  assert.match(html, /已绑定 MusicBrainz 发行版/);
  assert.doesNotMatch(html, /<input|添加背面照片|输入条形码|确认此版本并生成/);
  assert.doesNotMatch(button(html, '生成数字实体'), /disabled/);
});
test('无条码但已确认 MusicBrainz 发行版仍可生成数字实体', () => {
  const html = render({record: {...record, releaseInfo: {barcode: '', musicBrainzReleaseId: id}}});
  assert.match(html, /已绑定 MusicBrainz 发行版/);
  assert.doesNotMatch(button(html, '生成数字实体'), /disabled/);
});

test('必须先保存发行版，并已配置模型才能生成', () => {
  assert.match(button(render({releaseId: ''}), '生成数字实体'), /disabled/);
  assert.match(button(render({unsaved: true}), '生成数字实体'), /disabled/);
  assert.match(button(render({stale: true}), '生成数字实体'), /disabled/);
  assert.match(button(render({}, false), '生成数字实体'), /disabled/);
  assert.match(render({}, false), /图集预览无需模型/);
});
test('失败任务可重试，后台生成任务可取消，不重复选择发行版', () => {
  const failed = render({}, true, {id: 'job', status: 'failed', error: '图集暂不可用'});
  assert.doesNotMatch(button(failed, '重新生成数字实体'), /disabled/);
  assert.match(failed, /图集暂不可用/);
  const running = render({}, true, {id: 'job', status: 'running', message: '生成中'});
  assert.match(button(running, '取消任务'), /type="button"/);
  assert.doesNotMatch(running, /重新匹配发行版本/);
});
test('成功实体沿用已保存版本，估计尺寸不会冒充实测', () => {
  const job = {id: 'job', status: 'succeeded', releaseId: id,
    entity: {packaging: {structure: 'gatefold', panels: 2, holder: 'pocket',
      pockets: 'both', pocketOpening: 'inner', discs: 2}, surfaces: {}, warnings: [],
      calibration: {spine: {widthRatio: .001, basis: 'image-estimate', asset: 'photo-0.jpg',
        origin: 'edition-reference', sourceUrl: ''}}}};
  const html = render({}, true, job);
  assert.match(html, /数字实体已生成/);
  assert.match(html, /并非实测尺寸/);
  assert.doesNotMatch(html, /生成数字实体<\/button>/);
});


test('无模型也提供人工选图，AI 路径仍需已配置的模型', () => {
  const html=render({},false);
  assert.match(button(html,'生成数字实体'),/disabled/);
  assert.doesNotMatch(button(html,'人工选图生成（无需 AI）'),/disabled/);
});
test('已确认人工选图任务有来源受限的映射界面',()=>{
  const job={id:'a'.repeat(32),status:'needs_input',generationMode:'guided',
    phase:'awaiting_art_selection',releaseId:id,
    candidates:[{id,packaging:'Cardboard/Paper Sleeve',discCount:1,
      artwork:[{id:'101',types:['Front']},{id:'102',types:['Back']},{id:'103',types:['Medium']}],
      editionReferences:[{status:'verified',images:[{sourceId:'discogs:42:0'}]}]}]};
  const html=render({},false,job);
  assert.match(html,/album-engine-mount--guided-editor/);
  assert.doesNotMatch(html, /<select/);
  assert.doesNotMatch(html,/请先配置视觉模型/);
});

test('历史已发布实体缺少可选说明时仍能在编辑中校准盘面',()=>{
 const job={id:'job',status:'succeeded',releaseId:id,entity:{packaging:{structure:'jewel'},surfaces:{disc:{asset:'photo-0.png'}}}};
 const html=render({},true,job);
 assert.match(html,/数字实体已生成/);
 assert.match(html,/校准盘面/);
});

test('插件缺席时保留历史任务，只提供安装入口，不发送生成与校准操作', () => {
  const html = render({}, true, {id: 'saved-job', status: 'succeeded', releaseId: id}, false);
  assert.match(html, /安装 Album Engine/);
  assert.match(html, /已有实体资料与素材已保留/);
  assert.match(html, /data-task-id="saved-job"/);
  assert.match(html, /href="#settings"/);
  assert.doesNotMatch(html, /<button|校准盘面|album-engine-mount/);
});
