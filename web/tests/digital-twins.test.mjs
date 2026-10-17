import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';

import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const {output, source, require} = compiledSources();

const {mergeTwinIndex, twinViewerRecord, twinBusy, twinBarcodeMatches} = require(join(output, 'core/digital-twins.js'));
const {albumTextureSource} = require(join(output, 'core/album-model-assets.js'));

const ready = {id: 'task2', recordId: 'copy', seq: 9, status: 'succeeded', error: '', entity: {
  packaging: {structure: 'gatefold', discs: 2}, warnings: [],
  surfaces: {front: {asset: 'caa-123.jpg', region: [.1, .1, .9, .1, .9, .9, .1, .9]}, back: {asset: 'photo-0.png'}},
}};

test('条码草稿只有格式变更可沿用确认；换号、删位和前导零变化必须重新查询', () => {
  const reviewed = '4988013047105';
  assert.equal(twinBarcodeMatches('４９８８０１３０４７１０５', reviewed), true);
  assert.equal(twinBarcodeMatches(' 4988-0130 47105 ', reviewed), true);
  for (const draft of ['4988013047106', '498801304710', '', '04988013047105'])
    assert.equal(twinBarcodeMatches(draft, reviewed), false);
  assert.equal(twinBarcodeMatches('', ''), false);
});

test('完成后迟到的排队/运行响应不会回退状态，旧 epoch 不共用任务身份', () => {
  const current = {epoch: 'one', revision: 19, configured: true, jobs: {copy: ready}};
  const delayed = {epoch: 'one', revision: 17, configured: true, jobs: {copy: {...ready, seq: 7, status: 'running'}}};
  assert.equal(mergeTwinIndex(current, delayed), current);
  const restored = {epoch: 'two', revision: 1, configured: true, jobs: {}};
  assert.equal(mergeTwinIndex(current, restored), restored);
});

test('重复轮询保留已完成实体的对象身份，避免重建模型或丢失旋转位置', () => {
  const current = {epoch: 'one', revision: 19, configured: true, jobs: {copy: ready}};
  const next = structuredClone(current); next.revision = 20;
  assert.equal(mergeTwinIndex(current, next).jobs.copy, ready);
  next.jobs.copy.status = 'stale'; next.jobs.copy.error = 'input changed';
  assert.notEqual(mergeTwinIndex(current, next).jobs.copy, ready);
});

test('只有已发布实体能进入 3D；包装资料本身、生成中与失败结果保持 2D', () => {
  const record = {id: 'copy', packaging: {structure: 'gatefold'}, cover: '/api/cover/original.png'};
  assert.equal(twinViewerRecord(record), null);
  for (const status of ['queued', 'running', 'failed', 'needs_input', 'cancelled', 'stale', 'interrupted'])
    assert.equal(twinViewerRecord(record, {...ready, status}), null);
  assert.equal(twinViewerRecord(record, {...ready, entity: null}), null);
  assert.equal(twinBusy({...ready, status: 'running'}), true);
  assert.equal(twinBusy(ready), false);
});

test('模型引用不可变任务资产与独立四角区域，不改副本照片或原封面', () => {
  const record = Object.freeze({id: 'copy', photoCount: 3, revision: 5, cover: '/api/cover/original.png',
    packaging: Object.freeze({structure: 'jewel', photos: Object.freeze({front: 2})})});
  const view = twinViewerRecord(record, ready);
  assert.equal(view.packaging.structure, 'gatefold');
  assert.equal(albumTextureSource(view, 'front'), '/api/twin-assets/task2/caa-123.jpg');
  assert.equal(albumTextureSource(view, 'disc'), '');
  assert.deepEqual(view.packaging.photoRegions.front, ready.entity.surfaces.front.region);
  assert.equal(record.packaging.structure, 'jewel'); assert.equal(record.cover, '/api/cover/original.png');
});


test('连续折线与图像估计仅进入展示派生记录，保留来源且不改实体或账本', () => {
  const record = {id: 'copy', packaging: {structure: 'jewel'}, cover: ''};
  const job = structuredClone(ready);
  job.entity.surfaces.spine = {asset: 'spread.jpg', warpRows: [[.48, .1, .50, .1], [.47, .5, .51, .5], [.48, .9, .50, .9]]};
  job.entity.calibration = {spine: {widthRatio: .02, basis: 'image-estimate', asset: 'spread.jpg', sourceUrl: 'https://example.com/spread', origin: 'reference', reliefMm: [0, .1, 0]}};
  const snapshot = structuredClone(job);
  const view = twinViewerRecord(record, job);
  assert.deepEqual(view.modelWarpRows.spine, job.entity.surfaces.spine.warpRows);
  assert.deepEqual(view.modelCalibration, job.entity.calibration);
  view.modelWarpRows.spine[0][0] = 0;
  view.modelCalibration.spine.reliefMm[1] = 0;
  assert.deepEqual(job, snapshot, 'viewer owns independent calibration copies');
  assert.equal(record.modelWarpRows, undefined);
  assert.equal(record.modelCalibration, undefined);
});

test('旧实体不增加校准或行映射的展示字段', () => {
  const view = twinViewerRecord({id: 'copy', packaging: {structure: 'jewel'}, cover: ''}, ready);
  assert.equal(Object.hasOwn(view, 'modelCalibration'), false);
  assert.equal(Object.hasOwn(view, 'modelWarpRows'), false);
});

test('手动盘面校准只加入派生展示字段，不修改原始实体及资源引用', () => {
  const record = {id: 'copy', packaging: {structure: 'jewel'}, cover: ''};
  const job = structuredClone(ready);
  job.entity.surfaces.disc = {asset: 'disc-original.png', sourceUrl: '', origin: 'record-photo',
    discCalibration: {source: 'manual', outer: {cx:.49,cy:.51,rx:.42,ry:.35,angle:.1}}};
  const source = structuredClone(job);
  const view = twinViewerRecord(record, job);
  assert.deepEqual(view.modelDiscCalibrations.disc, job.entity.surfaces.disc.discCalibration);
  view.modelDiscCalibrations.disc.outer.rx = .2;
  assert.deepEqual(job, source);
  assert.equal(albumTextureSource(view, 'disc'), '/api/twin-assets/task2/disc-original.png');
});

test('安装补齐持久模型资源时，同序号任务也刷新清单，后续轮询继续保留查看器', () => {
  const current = {epoch: 'one', revision: 19, configured: true, jobs: {copy: ready}};
  const next = structuredClone(current);
  next.jobs.copy.models = {version: '0.3.0', modelSet: 'album-rig-1', files: {
    'jewel.glb': {sha256: 'a'.repeat(64), url: '/api/twin-model-assets/task2/jewel.glb'},
  }};
  const merged = mergeTwinIndex(current, next);
  assert.equal(merged.jobs.copy.models, next.jobs.copy.models);
  assert.notEqual(merged.jobs.copy, ready);
  assert.equal(mergeTwinIndex(merged, structuredClone(next)).jobs.copy, merged.jobs.copy);
});
