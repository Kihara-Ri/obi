import {useEffect, useRef, useState} from 'react';
import type {AlbumRecord, TwinReleaseCandidate} from '../types';
import {useApp} from '../state/AppContext';
import {ApiError} from '../core/api';
import {twinBarcodeMatches, twinBusy, twinViewerRecord} from '../core/digital-twins';
import {spineCalibrationFit} from '../core/album-spine-fit';

function ReleaseReview({candidate}: {candidate: TwinReleaseCandidate}) {
  const info = [
    ['条形码', candidate.barcode], ['发行日期', candidate.date], ['发行地区', candidate.country],
    ['唱片公司', candidate.label], ['目录编号', candidate.catalogNumber],
    ['版本', candidate.edition], ['介质', candidate.media.map(media => media.format).filter(Boolean).join(' / ')],
    ['光盘数量', candidate.discCount > 0 ? String(candidate.discCount) : ''],
    ['包装结构', candidate.packaging || '未收录，请以实物为准'],
  ];
  const artworkNames: Readonly<Record<string, string>> = {Front: '正面', Back: '背面', Spine: '书脊',
    Medium: '盘面', Booklet: '内页', Other: '其他'};
  const artLabel = (types: string[]) => types.map(type => artworkNames[type] ?? type).join(' · ') || '实物图';
  return <div className="twin-release-review">
    <div className="twin-release-heading"><strong>{candidate.title}</strong><span>{candidate.artist}</span></div>
    <dl className="twin-release-data">{info.map(([label, value]) => value ? <div key={label}><dt>{label}</dt><dd>{value}</dd></div> : null)}</dl>
    <p className="small-note">图集仅显示此发行版已收录的内容；缺少的背面、书脊或收纳结构仍需实物照片核对。</p>
    {candidate.artwork.length ? <div className="twin-artwork" aria-label="发行版实物图集">
      {candidate.artwork.map(art => <figure key={art.id}>
        {art.previewUrl ? <img src={art.previewUrl} loading="lazy" alt={artLabel(art.types)}/>
          : <span className="twin-artwork-unavailable">{art.previewStatus === 'unavailable' ? '预览暂不可用' : '未加载预览'}</span>}
        <figcaption>{artLabel(art.types)}{art.comment ? ' · ' + art.comment : ''}</figcaption>
      </figure>)}
    </div> : <p className="small-note">{candidate.artworkStatus === 'unavailable'
      ? '实物图集暂时无法读取，生成前将重新检查。' : '此发行版尚未收录实物图，生成时会检查本副本照片。'}</p>}
    {candidate.media.some(media => media.tracks.length) ? <details className="twin-tracks"><summary>核对曲目</summary>
      {candidate.media.map(media => <div key={media.position}><p className="small-note">CD {media.position} · {media.format}</p>
        <ol>{media.tracks.map(track => <li key={track.position}>{track.title}</li>)}</ol></div>)}
    </details> : null}
    {candidate.editionReferences?.map((reference, index) => <details key={reference.id ?? index}>
      <summary>同版实物参考 · Discogs</summary>
      {reference.status === 'verified' ? <>
        <p className="small-note">已按完整条形码和目录编号核对。来源说明用于确认发行版结构，照片中的磨损不代表本副本。</p>
        {reference.notes ? <p>{reference.notes}</p> : null}
        {reference.url ? <a href={reference.url} target="_blank" rel="noopener noreferrer">查看同版 Discogs 实物资料 ↗</a> : null}
      </> : <p className="small-note">{reference.status === 'unavailable' ? 'Discogs 实物参考暂时无法读取。'
        : reference.status === 'mismatched' ? '关联的 Discogs 资料与本条码或目录编号不一致，未采用。'
        : reference.status === 'ambiguous' ? '关联到多个 Discogs 版本，尚未采用其中任何版本。'
        : '该发行版没有可读取的 Discogs 实物参考。'}仍以已核对的图集和本副本照片为准。</p>}
    </details>)}
    <a href={candidate.url} target="_blank" rel="noopener noreferrer">查看 MusicBrainz 发行资料 ↗</a>
  </div>;
}

/** Edit-only flow: barcode lookup, physical edition review, then explicit generation. */
export function TwinControls({record, unsaved = false, saving = false, stale = false, onAddPhoto}: {
  record: AlbumRecord; unsaved?: boolean; saving?: boolean; stale?: boolean; onAddPhoto(): void;
}) {
  const app = useApp(), job = app.twins.jobs[record.id];
  const [barcode, setBarcode] = useState(job?.barcode ?? '');
  const [manual, setManual] = useState(!record.photoCount || job?.barcodeSource === 'manual');
  const [selected, setSelected] = useState('');
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const gate = useRef(false);
  const barcodeEdited = useRef(false);
  const busy = twinBusy(job), blocked = unsaved || saving || stale;
  const fit = spineCalibrationFit(twinViewerRecord(record, job) ?? record);
  const reviewing = job?.status === 'needs_input' && job.phase === 'awaiting_confirmation';
  const barcodeChanged = reviewing && !twinBarcodeMatches(barcode, job.barcode ?? '');
  const needsBarcode = job?.status === 'needs_input' && job.phase === 'awaiting_barcode';
  const candidates = reviewing ? job.candidates ?? [] : [];
  const candidateIds = candidates.map(candidate => candidate.id).join(',');
  useEffect(() => {
    if (!barcodeEdited.current && job?.barcode) setBarcode(job.barcode);
    if (!barcodeEdited.current && job?.barcodeSource === 'manual') setManual(true);
    if (needsBarcode) setManual(true);
    if (reviewing) setSelected(old => candidates.some(candidate => candidate.id === old)
      ? old : candidates.length === 1 ? candidates[0].id : '');
  }, [job?.id, job?.barcode, job?.barcodeSource, needsBarcode, reviewing, candidateIds]);

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
    if (busy || blocked) return;
    void act(() => app.startTwin({recordId: record.id, recordRevision: record.revision,
      expectedJobId: job?.id ?? null, ...((manual || reviewing || job?.status === 'succeeded') && barcode.trim()
        ? {barcode: barcode.trim()} : {})}));
  };
  const confirm = () => {
    if (!job || !reviewing || !selected || barcodeChanged || blocked || busy || !app.twins.configured) return;
    void act(() => app.confirmTwin({id: job.id, releaseId: selected}));
  };
  const hasManualInput = manual || needsBarcode;
  const lookupDisabled = sending || busy || blocked || (hasManualInput && !barcode.trim());

  return <section className="twin-controls" aria-label="数字实体生成" aria-busy={busy || sending}
    data-task-id={job?.id ?? ''} data-status={job?.status ?? 'none'} data-phase={job?.phase ?? ''}>
    <p className="twin-status" role="status" aria-live="polite">{job?.status === 'succeeded' ? '数字实体已生成'
      : barcodeChanged ? '条形码已修改，请重新匹配发行版本'
      : reviewing ? '已匹配发行版本，请对照实物确认'
      : busy ? job?.message || '正在处理数字实体任务'
      : needsBarcode ? job.error || '未找到清晰可读的条形码，请输入号码或添加背面照片'
      : job?.error || (job?.status === 'cancelled' ? '已取消任务' : '先从实物条形码匹配发行版本')}
    </p>
    {stale ? <p className="twin-save-first" role="status">副本已在其他窗口更新，请关闭并重新打开编辑，核对最新资料后再生成。当前未保存输入仍保留在本表单。</p>
      : blocked ? <p className="twin-save-first" role="status">请先保存修改，再匹配或生成数字实体。当前输入和照片仍保留在本表单。</p> : null}
    {app.twinSyncError ? <p className="small-note" role="status">{app.twinSyncError}</p> : null}
    {error ? <p className="twin-error" role="alert">{error}</p> : null}
    {uncertain ? <>
      <p className="small-note">提交结果尚未确认，先同步原任务状态，避免重复执行。</p>
      <button type="button" disabled={sending} onClick={() => void act(app.refreshTwins)}>同步任务状态</button>
    </> : busy ? <>
      <p className="small-note">任务在后台继续，关闭编辑不会取消。</p>
      <button type="button" className="quiet twin-cancel" disabled={sending}
        onClick={() => job && void act(() => app.cancelTwin(job.id))}>取消任务</button>
    </> : <>
      {reviewing ? <div className="twin-editions" role="radiogroup" aria-label="匹配到的发行版本">
        {candidates.map(candidate => <div className={'twin-edition' + (selected === candidate.id ? ' is-selected' : '')} key={candidate.id}>
          <label className="twin-edition-pick"><input type="radio" name={'twin-edition-' + record.id} value={candidate.id}
            checked={selected === candidate.id} disabled={sending || blocked || barcodeChanged} onChange={() => setSelected(candidate.id)}/><span>选择此发行版本</span></label>
          <ReleaseReview candidate={candidate}/>
        </div>)}
        <p className="small-note">条形码可能对应多个版本，请核对日期、目录编号、曲目和实物图后确认。</p>
        {barcodeChanged ? <p className="small-note" role="status">以上资料属于先前查询的条形码，重新匹配后才能确认。</p> : null}
        {!app.twins.configured ? <p className="small-note">发行资料已保留，<a href="#settings">配置视觉模型</a>后可生成数字实体。</p> : null}
        <button type="button" className="primary twin-start" disabled={sending || blocked || barcodeChanged || !selected || !app.twins.configured}
          onClick={confirm}>{sending ? '正在确认任务' : '确认此版本并生成数字实体'}</button>
      </div> : job?.status === 'succeeded' ? <>
        <p className="small-note">打开收藏展示中的封面即可查看。</p>
        {fit ? <>
          <p className="small-note">书脊宽度为图像比例估计，按封板参考尺寸折算约 {fit.requestedMm.toFixed(2)} mm，尚未实测。</p>
          {job.entity?.packaging.size ? <p className="small-note">封板按填写宽高展示；深度不决定折脊宽度，袋腔按 CD 间隙保留。</p> : null}
          {fit.status === 'minimum-cd-fit' ? <p className="small-note">照片估计偏窄：为保留光盘所需的容纳间隙，模型按约 {fit.appliedMm.toFixed(2)} mm 的参考宽度显示。补拍闭合侧面可继续校准。</p> : null}
        </> : null}
        {job.entity?.warnings.length ? <details><summary>生成说明</summary>{job.entity.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</details> : null}
      </> : null}

      {!reviewing && job?.status !== 'succeeded' ? <>
        {!hasManualInput ? <p className="small-note">将读取已保存的实物照片，找到清晰条形码后查询 MusicBrainz。</p> : null}
        {hasManualInput ? <label className="twin-barcode" htmlFor={'twin-barcode-' + record.id}>实物条形码号
          <input id={'twin-barcode-' + record.id} inputMode="numeric" autoComplete="off" value={barcode}
            disabled={sending || blocked} maxLength={32} placeholder="例如：4988013047105"
            onChange={event => {barcodeEdited.current = true; setBarcode(event.target.value); setError('');}}/>
        </label> : null}
        <button type="button" className="primary twin-start" disabled={lookupDisabled} onClick={start}>
          {sending ? '正在提交查询' : hasManualInput ? '匹配条形码对应的发行版本' : '识别实物条形码并匹配版本'}
        </button>
        <div className="twin-input-actions">
          <button type="button" className="quiet" disabled={sending || saving} onClick={onAddPhoto}>添加背面照片</button>
          {!hasManualInput ? <button type="button" className="quiet" disabled={sending} onClick={() => setManual(true)}>输入条形码号</button> : null}
        </div>
      </> : <details className="twin-change-barcode"><summary>重新核对条形码</summary>
        <label className="twin-barcode" htmlFor={'twin-barcode-' + record.id}>实物条形码号
          <input id={'twin-barcode-' + record.id} inputMode="numeric" autoComplete="off" value={barcode}
            disabled={sending || blocked} maxLength={32} onChange={event => {barcodeEdited.current = true; setManual(true); setBarcode(event.target.value);}}/>
        </label>
        <button type="button" disabled={lookupDisabled || !barcode.trim()} onClick={start}>重新匹配发行版本</button>
      </details>}
    </>}
  </section>;
}
