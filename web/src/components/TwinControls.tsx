import {useRef, useState} from 'react';
import type {AlbumRecord} from '../types';
import {useApp} from '../state/AppContext';
import {ApiError} from '../core/api';
import {twinBusy, twinViewerRecord} from '../core/digital-twins';
import {spineCalibrationFit} from '../core/album-spine-fit';

/** Edition lookup is owned by RecordForm; this control only generates the already-confirmed release. */
export function TwinControls({record, releaseId, unsaved = false, saving = false, stale = false}: {
  record: AlbumRecord; releaseId: string; unsaved?: boolean; saving?: boolean; stale?: boolean;
}) {
  const app = useApp();
  const job = app.twins.jobs[record.id];
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const gate = useRef(false);
  const blocked = unsaved || saving || stale;
  const busy = twinBusy(job);
  const confirmed = !!releaseId && !!record.releaseInfo?.barcode &&
    record.releaseInfo.musicBrainzReleaseId === releaseId;
  const current = confirmed && job?.status === 'succeeded' && job.releaseId === releaseId;
  const fit = spineCalibrationFit(twinViewerRecord(record, current ? job : undefined) ?? record);

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
  const start = () => {
    if (!confirmed || blocked || busy || !app.twins.configured) return;
    void act(() => app.startTwin({recordId: record.id,
      recordRevision: record.revision, expectedJobId: job?.id ?? null}));
  };

  return <section className="twin-controls" aria-label="生成数字实体"
    data-task-id={job?.id ?? ''} data-status={job?.status ?? 'none'} data-phase={job?.phase ?? ''}>
    {!confirmed ? <p className="small-note">请先确认上方条形码对应的发行版本，并保存这张专辑。</p>
      : <p className="small-note">已绑定 MusicBrainz 发行版。数字实体直接使用此版本的 Cover Art Archive 正反面、内页和盘面，无需再次输入条码或选择版本。</p>}
    {stale ? <p className="twin-save-first" role="status">副本已在其他窗口更新，请关闭并重新打开编辑页面。</p>
      : blocked ? <p className="twin-save-first" role="status">请先保存本次修改，再生成数字实体。</p> : null}
    {app.twinSyncError ? <p className="small-note" role="status">{app.twinSyncError}</p> : null}
    {error ? <p className="twin-error" role="alert">{error}</p> : null}
    {uncertain ? <button type="button" disabled={sending} onClick={() => void act(app.refreshTwins)}>同步任务状态</button> : null}
    {busy ? <>
      <p className="twin-status" role="status">{job?.message || '数字实体生成中，关闭编辑页面不会中断任务'}</p>
      <button type="button" className="quiet twin-cancel" disabled={sending}
        onClick={() => job && void act(() => app.cancelTwin(job.id))}>取消任务</button>
    </> : current ? <>
      <p className="twin-status" role="status">✓ 数字实体已生成，可在收藏展示中查看</p>
      {fit ? <>
        <p className="small-note">书脊宽度由图像估计，约 {fit.requestedMm.toFixed(2)} mm，并非实测尺寸。</p>
        {fit.status === 'minimum-cd-fit' ? <p className="small-note">为保留 CD 间隙，展示采用约 {fit.appliedMm.toFixed(2)} mm 的参考书脊宽度。</p> : null}
      </> : null}
      {job?.entity?.warnings.length ? <details><summary>生成说明</summary>{job.entity.warnings.map((warning,i) => <p key={i}>{warning}</p>)}</details> : null}
    </> : <>
      {job?.error ? <p className="twin-status" role="status">{job.error}</p> : null}
      {!app.twins.configured ? <p className="small-note">图集预览无需模型。要生成可交互的数字实体，请先在设置中配置视觉模型。</p> : null}
      <button type="button" className="primary twin-start" disabled={sending || !confirmed || blocked || !app.twins.configured}
        onClick={start}>{sending ? '正在提交' : job ? '重新生成数字实体' : '生成数字实体'}</button>
    </>}
  </section>;
}
