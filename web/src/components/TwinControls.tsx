// TwinControls：编辑专辑里「数字实体」一栏。数字实体的生成已交给 Album Engine 项目，这里只负责
// 展示已有实体的状态，以及用引擎插件里的编辑器补充 / 移除独立附件、校准盘面。
import {useCallback, useState} from 'react';
import type {AlbumRecord} from '../types';
import {useApp} from '../state/AppContext';
import {twinBusy} from '../core/digital-twins';
import {TwinAccessoriesEditor} from './TwinAccessoriesEditor';
import {DiscCalibrationEditor} from './DiscCalibrationEditor';

export function TwinControls({record, releaseId, unsaved = false, saving = false, stale = false}: {
  record: AlbumRecord; releaseId: string; unsaved?: boolean; saving?: boolean; stale?: boolean;
}) {
  const app = useApp();
  const job = app.twins.jobs[record.id];
  const engine = app.albumEngine;
  const runtime = engine.runtime;
  const [editingAccessories, setEditingAccessories] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const closeAccessories = useCallback(() => setEditingAccessories(false), []);
  const closeCalibration = useCallback(() => setCalibrating(false), []);
  const blocked = unsaved || saving || stale;
  const confirmed = !!releaseId && record.releaseInfo?.musicBrainzReleaseId === releaseId;
  const current = confirmed && job?.status === 'succeeded' && job.releaseId === releaseId;
  const fit = runtime && current && job?.entity ? (job.entity.document ? runtime.spineCalibrationFitForEntity(job.entity.document) : runtime.spineCalibrationFit({packaging: job.entity.packaging, modelCalibration: job.entity.calibration})) : null;

  if (!runtime) return <section className="twin-controls" aria-label="数字实体" data-task-id={job?.id ?? ''}>
    <p className="small-note">{engine.status?.installed ? engine.loading ? '正在加载 Album Engine…' : 'Album Engine 暂不可用。请在设置中检查引擎状态。' : '未安装 Album Engine，数字实体不可查看。可在设置的「高级」中安装。'}</p>
    {job ? <p className="small-note">已有实体资料与素材已保留，安装引擎后可继续使用。</p> : null}
    <a className="link-button" href="#settings">打开设置</a>
  </section>;

  return <section className="twin-controls" aria-label="数字实体"
    data-task-id={job?.id ?? ''} data-status={job?.status ?? 'none'} data-phase={job?.phase ?? ''}>
    {stale ? <p className="twin-save-first" role="status">副本已在其他窗口更新，请关闭并重新打开编辑页面。</p>
      : blocked ? <p className="twin-save-first" role="status">请先保存本次修改，再编辑数字实体。</p> : null}
    {app.twinSyncError ? <p className="small-note" role="status">{app.twinSyncError}</p> : null}
    {twinBusy(job) ? <p className="twin-status" role="status">{job?.message || '这个数字实体正在由 Album Engine 处理'}</p>
    : current ? <>
      <p className="twin-status" role="status">✓ 已有数字实体，可在收藏展示中查看</p>
      {fit ? <>
        <p className="small-note">书脊宽度由图像估计，约 {fit.requestedMm.toFixed(2)} mm，并非实测尺寸。</p>
        {fit.status === 'minimum-cd-fit' ? <p className="small-note">为保留 CD 间隙，展示采用约 {fit.appliedMm.toFixed(2)} mm 的参考书脊宽度。</p> : null}
      </> : null}
      <button type="button" className="quiet" disabled={blocked} onClick={() => setEditingAccessories(value => !value)}>
        {editingAccessories ? '收起附件编辑' : '补充或移除独立附件'}
      </button>
      {editingAccessories && job?.entity ? <TwinAccessoriesEditor record={record} job={job}
        onSaved={app.refreshTwins} onClose={closeAccessories}/> : null}
      {job?.entity && Object.keys(job.entity.surfaces).some(role => role.startsWith('disc')) ?
        <button type="button" className="quiet" disabled={blocked} onClick={() => setCalibrating(true)}>校准盘面</button> : null}
      {calibrating && job ? <DiscCalibrationEditor job={job} onSaved={app.refreshTwins} onClose={closeCalibration}/> : null}
      {job?.entity?.warnings?.length ? <details><summary>生成说明</summary>{job.entity.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</details> : null}
    </> : <p className="small-note">这张专辑还没有数字实体。数字实体在 Album Engine 项目中生成，发布后会出现在这里。</p>}
  </section>;
}
