import {useEffect, useRef, useState} from 'react';
import type {AlbumRecord} from '../types';
import {useApp} from '../state/AppContext';
import {ApiError} from '../core/api';
import {twinBusy} from '../core/digital-twins';
import {Dropdown} from './ui/Dropdown';

export function TwinControls({record, onView}: {record: AlbumRecord; onView?(): void}) {
  const app = useApp(), job = app.twins.jobs[record.id];
  const [instructions, setInstructions] = useState(job?.instructions ?? '');
  const [release, setRelease] = useState(job?.releaseId ?? '');
  const edited = useRef(false);
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const gate = useRef(false);
  const busy = twinBusy(job);
  const needsEdition = job?.status === 'needs_input' && !!job.candidates?.length && !release;
  useEffect(() => {
    if (job && !edited.current) {setInstructions(job.instructions ?? ''); setRelease(job.releaseId ?? '');}
  }, [job?.id]);
  const start = async () => {
    if (gate.current || busy) return;
    gate.current = true; setSending(true); setError('');
    try {
      await app.startTwin({recordId: record.id, recordRevision: record.revision,
        expectedJobId: job?.id ?? null, instructions, releaseId: release});
      setUncertain(false);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : '未能确认任务状态'); setUncertain(true);
      if (exc instanceof ApiError && exc.status === 409) await app.refresh().catch(() => {});
    } finally {gate.current = false; setSending(false);}
  };
  const cancel = async () => {
    if (!job || gate.current) return;
    gate.current = true; setSending(true);
    try {await app.cancelTwin(job.id); setError('');}
    catch (exc) {setError(exc instanceof Error ? exc.message : '取消失败，请刷新确认');}
    finally {gate.current = false; setSending(false);}
  };
  if (job?.status === 'succeeded') return <div className="twin-controls" data-task-id={job.id} data-status={job.status}>
    <p className="twin-status" role="status">数字实体已生成</p>
    {onView ? <button type="button" className="primary" onClick={onView}>查看数字实体</button>
      : <a href="#gallery">在收藏展示中查看</a>}
    {job.entity?.warnings.length ? <details><summary>生成说明</summary>{job.entity.warnings.map((w, i) => <p key={i}>{w}</p>)}</details> : null}
  </div>;
  return <div className="twin-controls" aria-busy={busy || sending} data-task-id={job?.id ?? ''} data-status={job?.status ?? 'none'}>
    <p className="twin-status" role="status" aria-live="polite">{busy ? job?.message || '正在生成数字实体'
      : job?.error || (job?.status === 'cancelled' ? '已取消生成' : '这张副本还没有数字实体')}</p>
    {app.twinSyncError ? <p className="small-note" role="status">{app.twinSyncError}</p> : null}
    {busy ? <p className="small-note">正在后台生成，关闭后仍会继续。</p> : uncertain ?
      <p className="small-note">提交结果尚未确认，请先确认原任务状态。</p> : <>
      <details className="twin-options" open={job?.status === 'needs_input' || undefined}>
        <summary>生成要求与发行版本</summary>
        <label>还原要求（选填）<textarea value={instructions} maxLength={2000} rows={2} disabled={sending}
          onChange={event => {edited.current = true; setInstructions(event.target.value);}} placeholder="例如：还原朝内开口的双 CD 纸套"/></label>
        {job?.candidates?.length ? <Dropdown id={'twin-release-' + record.id} label="确认 CD 发行版本" value={release || '__none'}
          options={[{value: '__none', label: '请选择具体 CD 发行版本'}, ...job.candidates.map(candidate => ({value: candidate.id,
            label: [candidate.title, candidate.releaseInfo.country, candidate.releaseInfo.releaseDate, candidate.releaseInfo.catalogNumber].filter(Boolean).join(' · ')}))]}
          onPick={value => {edited.current = true; setRelease(value === '__none' ? '' : value);}}/> : null}
        <label>MusicBrainz 发行版链接（选填）<input value={release} disabled={sending} onChange={event => {edited.current = true; setRelease(event.target.value);}}
          placeholder="https://musicbrainz.org/release/…"/></label>
        <p className="small-note">agent 会使用本副本照片和确认的发行版图集。</p>
      </details>
    </>}
    {!app.twins.configured ? <p className="small-note"><a href="#settings">先配置视觉模型</a>，用于执行生成 agent。</p> : null}
    {error && !busy ? <p className="twin-error" role="alert">{error}</p> : null}
    <button type="button" className="primary twin-start" disabled={sending || busy || needsEdition || !app.twins.configured} onClick={() => void start()}>
      {busy ? '正在生成数字实体' : sending ? '正在确认任务' : uncertain ? '确认任务状态' : job ? '重试生成' : '生成数字实体'}
    </button>
    {busy ? <button type="button" className="quiet twin-cancel" disabled={sending} onClick={() => void cancel()}>取消生成</button> : null}
  </div>;
}
