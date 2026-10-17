import {useCallback, useRef, useState} from 'react';
import type {AlbumRecord} from '../types';
import {useApp} from '../state/AppContext';
import {ApiError} from '../core/api';
import {twinBusy} from '../core/digital-twins';
import {GuidedTwinEditor} from './GuidedTwinEditor';
import {TwinAccessoriesEditor} from './TwinAccessoriesEditor';
import {DiscCalibrationEditor} from './DiscCalibrationEditor';

/** Edition lookup is owned by RecordForm; this control only generates the already-confirmed release. */
export function TwinControls({record, releaseId, unsaved = false, saving = false, stale = false}: {
  record: AlbumRecord; releaseId: string; unsaved?: boolean; saving?: boolean; stale?: boolean;
}) {
  const app = useApp();
  const job = app.twins.jobs[record.id];
  const engine = app.albumEngine;
  const runtime = engine.runtime;
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [editingAccessories,setEditingAccessories] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const closeAccessories = useCallback(() => setEditingAccessories(false), []);
  const closeCalibration = useCallback(() => setCalibrating(false), []);
  const gate = useRef(false);
  const blocked = unsaved || saving || stale;
  const busy = twinBusy(job);
  const confirmed = !!releaseId && record.releaseInfo?.musicBrainzReleaseId === releaseId;
  const current = confirmed && job?.status === 'succeeded' && job.releaseId === releaseId;
  const fit = runtime && current && job?.entity ? (job.entity.document ? runtime.spineCalibrationFitForEntity(job.entity.document) : runtime.spineCalibrationFit({packaging: job.entity.packaging, modelCalibration: job.entity.calibration})) : null;

  const act = async (fn: () => Promise<void>) => {
    if (gate.current) return;
    gate.current = true; setSending(true); setError('');
    try {await fn(); setUncertain(false);}
    catch (exc) {
      setError(exc instanceof Error ? exc.message : '未能确认任务状态');
      setUncertain(!(exc instanceof ApiError) || !exc.status);
      if (exc instanceof ApiError && exc.status === 409) await app.refresh().catch(() => {});
    } finally {gate.current = false; setSending(false);}
  };
  const start = (mode: 'ai' | 'guided') => {
    if (!runtime || !confirmed || blocked || busy || (mode === 'ai' && !app.twins.configured)) return;
    void act(() => app.startTwin({recordId: record.id,
      recordRevision: record.revision, expectedJobId: job?.id ?? null,mode}));
  };

  if (!runtime) return <section className="twin-controls" aria-label="生成数字实体" data-task-id={job?.id ?? ''}>
    <p className="small-note">{engine.status?.installed ? engine.loading ? '正在加载 Album Engine…' : 'Album Engine 暂不可用。请在设置中检查引擎状态。' : '安装 Album Engine 后可生成与查看 3D 数字实体。'}</p>
    {job ? <p className="small-note">已有实体资料与素材已保留，安装引擎后可继续使用。</p> : null}
    <a className="link-button" href="#settings">打开设置</a>
  </section>;

  return <section className="twin-controls" aria-label="生成数字实体"
    data-task-id={job?.id ?? ''} data-status={job?.status ?? 'none'} data-phase={job?.phase ?? ''}>
    {!confirmed ? <p className="small-note">请先通过条码或唱片编号确认发行版本，并保存这张专辑。</p>
      : <p className="small-note">已绑定 MusicBrainz 发行版。数字实体直接使用此版本的 Cover Art Archive 正反面、内页和盘面，无需再次查找或选择版本。</p>}
    {stale ? <p className="twin-save-first" role="status">副本已在其他窗口更新，请关闭并重新打开编辑页面。</p>
      : blocked ? <p className="twin-save-first" role="status">请先保存本次修改，再生成数字实体。</p> : null}
    {app.twinSyncError ? <p className="small-note" role="status">{app.twinSyncError}</p> : null}
    {error ? <p className="twin-error" role="alert">{error}</p> : null}
    {uncertain ? <button type="button" disabled={sending} onClick={() => void act(app.refreshTwins)}>同步任务状态</button> : null}
    {job?.generationMode==='guided' && job.status==='needs_input' && job.phase==='awaiting_art_selection' ?
      <GuidedTwinEditor job={job} record={record} disabled={blocked||sending} onSaved={app.refreshTwins}/>
    : busy ? <>
      <p className="twin-status" role="status">{job?.message || '数字实体生成中，关闭编辑页面不会中断任务'}</p>
      <button type="button" className="quiet twin-cancel" disabled={sending}
        onClick={() => job && void act(() => app.cancelTwin(job.id))}>取消任务</button>
    </> : current ? <>
      <p className="twin-status" role="status">✓ 数字实体已生成，可在收藏展示中查看</p>
      {fit ? <>
        <p className="small-note">书脊宽度由图像估计，约 {fit.requestedMm.toFixed(2)} mm，并非实测尺寸。</p>
        {fit.status === 'minimum-cd-fit' ? <p className="small-note">为保留 CD 间隙，展示采用约 {fit.appliedMm.toFixed(2)} mm 的参考书脊宽度。</p> : null}
      </> : null}
      <button type="button" className="quiet" onClick={()=>setEditingAccessories(value=>!value)}>
        {editingAccessories?'收起附件编辑':'补充或移除独立附件'}
      </button>
      {editingAccessories && job?.entity ? <TwinAccessoriesEditor record={record} job={job}
        onSaved={app.refreshTwins} onClose={closeAccessories}/> : null}
      {job?.entity && Object.keys(job.entity.surfaces).some(role => role.startsWith('disc')) ?
        <button type="button" className="quiet" onClick={() => setCalibrating(true)}>校准盘面</button> : null}
      {calibrating && job ? <DiscCalibrationEditor job={job} onSaved={app.refreshTwins} onClose={closeCalibration}/> : null}
      {job?.entity?.warnings?.length ? <details><summary>生成说明</summary>{job.entity.warnings.map((warning,i) => <p key={i}>{warning}</p>)}</details> : null}
    </> : <>
      {job?.error ? <p className="twin-status" role="status">{job.error}</p> : null}
      {!app.twins.configured ? <p className="small-note">图集预览无需模型。AI 生成需要配置视觉模型；人工选图可直接使用已核验原图与包装结构。</p> : null}
      <div className="twin-generate-actions">
        <button type="button" className="primary twin-start" disabled={sending || !confirmed || blocked || !app.twins.configured}
          onClick={()=>start('ai')}>{sending?'正在提交':job?'重新生成数字实体':'生成数字实体'}</button>
        <button type="button" className="quiet twin-start" disabled={sending || !confirmed || blocked}
          onClick={()=>start('guided')}>{sending?'正在提交':'人工选图生成（无需 AI）'}</button>
      </div>
    </>}
  </section>;
}
