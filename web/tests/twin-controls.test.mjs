import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';

import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const {output, source, require} = compiledSources();
const {TwinControls} = require(join(output, 'components/TwinControls.js'));
const {AppContext} = require(join(output, 'state/AppContext.js'));

const id = 'e618bce6-8e08-4628-9574-2d8f53b20db7';
const record = {id: 'copy', title: 'Islands', artist: 'King Crimson', version: 'Jewel Case', revision: 1,
  releaseInfo: {barcode: '4988013047105', musicBrainzReleaseId: id}};
function render(props = {}, configured = true, job = null) {
  const app = {twins: {jobs: job ? {copy: job} : {}, configured}, twinSyncError: ''};
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
  assert.match(html,/人工确认数字实体素材/);
  assert.match(html,/discogs:42:0/);
  assert.match(html,/确认图片与包装，生成 3D 实体/);
  assert.doesNotMatch(html,/请先配置视觉模型/);
});

test('历史已发布实体缺少可选说明时仍能在编辑中校准盘面',()=>{
 const job={id:'job',status:'succeeded',releaseId:id,entity:{packaging:{structure:'jewel'},surfaces:{disc:{asset:'photo-0.png'}}}};
 const html=render({},true,job);
 assert.match(html,/数字实体已生成/);
 assert.match(html,/校准盘面/);
});

test('附件编辑从固定样本恢复原有图源，直接保存不会默认移除所有附件',()=>{
 const fixture=JSON.parse(execFileSync('python3',['-c',`
import json,sys
from tools.seed_samples import seed_models,open_store
ids=seed_models(sys.argv[1]);s=open_store(sys.argv[1]);rid=ids['lift-fists']
print(json.dumps({'record':next(r for r in s.state()['records'] if r['id']==rid),'job':s.twin_index()['jobs'][rid]}))
`,join(output,'editor-samples')],{cwd:fileURLToPath(new URL('../../',import.meta.url)),encoding:'utf8'}));
 const {TwinAccessoriesEditor}=require(join(output,'components/TwinAccessoriesEditor.js'));
 const html=renderToStaticMarkup(createElement(TwinAccessoriesEditor,{...fixture,onSaved:async()=>{},onClose:()=>{}}));
 for(const source of ['photo:2','photo:3','photo:4'])assert.ok(html.includes('value="'+source+'" selected=""'),source+' stays selected');
});
