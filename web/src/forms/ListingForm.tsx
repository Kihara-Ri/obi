// 一键准备售卖资料；新草稿自动保存，已有文案先看候选，显式采用后才替换。
import {useEffect, useRef, useState} from 'react';
import {api} from '../core/api';
import {draftFor, listingContextChanged} from '../core/listing';
import type {ListingDraft, ListingPreferences as Preferences, ListingProvider} from '../core/listing';
import {useApp} from '../state/AppContext';
import type {AppCtx} from '../state/AppContext';
import {Field} from './fields';
import {useFormSubmit} from './shared';
import {useListingTask} from './useListingTask';
import {ListingReview} from '../components/ListingReview';
import {ListingOptions} from './ListingOptions';
import {ListingCopy} from '../components/ListingCopy/ListingCopy';
import {ListingPhotos} from '../components/ListingPhotos/ListingPhotos';
import {PhotoDownload} from '../components/PhotoDownload';
import {usePhotoFiles} from '../components/PhotoDownload/usePhotoFiles';
import {CopyButton} from '../components/CopyButton';
import {ListingSteps} from '../components/ListingSteps/ListingSteps';
import {Details} from '../components/ui/Details';
import './ListingForm.css';

export function openListingForm(app: AppCtx, id: string) {
  app.openDrawer({title: '售卖与上架资料', asForm: true, content: <ListingForm id={id}/>});
}

function ListingForm({id}: {id: string}) {
  const app = useApp();
  const current = app.rec(id)!;
  const r = useRef(current).current;
  const [revision, setRevision] = useState(r.revision);
  const [channel, setChannel] = useState(r.listingChannel || '');
  const [url, setUrl] = useState(r.listingUrl || '');
  const [draft, setDraft] = useState(() => draftFor(r));
  const [candidate, setCandidate] = useState<ListingDraft>();
  const localEdits = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(!!r.listingDraft || !!r.listingDescription);
  const [reviewOpen, setReviewOpen] = useState(false);
  const photos = usePhotoFiles(id, r.photoCount, r.photoRevision ?? 0, r.artist, r.title);
  const [supplement, setSupplement] = useState(r.listingDraft?.generation?.supplement ?? '');
  const [provider, setProvider] = useState<ListingProvider>();
  const [preferences, setPreferences] = useState<Preferences>();
  const [settingsBusy, setSettingsBusy] = useState(false);
  const {error, saving, run, setError} = useFormSubmit();
  const task = useListingTask(async result => {
    if (!result.draft) throw new Error('模型没有返回完整草稿，请重试');
    if (result.autoSaved && result.savedRevision) {
      setDraft(result.draft); setRevision(result.savedRevision); setCandidate(undefined);
      setDirty(false); localEdits.current = false; setSaved(true); app.setDrawerDirty(false);
      await app.refresh(); app.toast('上架资料已生成并保存');
    } else {setCandidate(result.draft); app.setDrawerDirty(true);}
  });
  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([
      api<ListingProvider>('listing/status', undefined, {signal: abort.signal}).then(setProvider),
      api<Preferences>('listing/preferences', undefined, {signal: abort.signal}).then(setPreferences),
    ]).catch(e => {if (!abort.signal.aborted) setError(e.message);});
    return () => abort.abort();
  }, []);
  const stale = current.revision !== revision;
  const busy = task.busy || saving || settingsBusy;
  const ready = r.photoCount ? provider?.ready : provider?.textReady;
  const change = (value: ListingDraft) => {setDraft(value); markDirty();};
  const markDirty = (protect = true) => {if (protect) localEdits.current = true; setDirty(true); setSaved(false); app.setDrawerDirty(true);};
  const generate = (reanalyze = false) => {
    setError('');
    void task.start({id, revision, photoRevision: r.photoRevision ?? 0, supplement,
      presetId: preferences?.defaultPreset, autoSave: !localEdits.current && !candidate,
      analysisJobId: task.job?.id, reanalyze});
  };
  const progress = task.job?.phase;
  const analysis = task.job?.analysis || draft.analysis;
  const shown = candidate ?? draft;
  const conflicts = shown.analysis?.conflicts ?? [];
  const saveDraft = () => {void run(app, () => api('listing/draft', {id, revision, draft, listing: {channel, url}}),
    '售卖草稿已保存', {backOnSave: true});};
  const phaseText = progress === 'writing' ? '正在生成文案…' : progress === 'saving' ? '正在保存草稿…'
    : r.photoCount ? '正在核对资料与照片…' : '正在整理已有资料…';
  return <form onSubmit={e => e.preventDefault()}>
    <div className="listing-reading-host">
    <div className="drawer-body listing-body">
      <ListingCopy draft={shown} saved={saved && !dirty} candidate={!!candidate} busy={busy || stale}
        ready={!!ready && !!preferences && !stale} onGenerate={() => generate()} onChange={change} onSave={saveDraft}/>
      {candidate ? <div className="listing-candidate-actions" aria-label="候选操作">
        <button type="button" disabled={stale || busy} onClick={async () => {
          setSettingsBusy(true); setError('');
          try {
            const result = await api<{revision: number}>('listing/draft', {id, revision, draft: candidate, listing: {channel, url}});
            setDraft(candidate); setRevision(result.revision); setCandidate(undefined); setDirty(false); localEdits.current = false; setSaved(true);
            app.setDrawerDirty(false); await app.refresh(); app.toast('已采用并保存新文案');
          } catch (e) {setError(e instanceof Error ? e.message : '保存失败');}
          finally {setSettingsBusy(false);}
        }}>采用并保存</button>
        <button type="button" disabled={busy} onClick={() => {setCandidate(undefined); app.setDrawerDirty(dirty);}}>保留原稿</button>
      </div> : null}
      {conflicts.length ? <button type="button" className="listing-conflict" onClick={() => setReviewOpen(true)}>
        版本有冲突 · 查看核对依据</button> : null}
      <div className="error" role="alert">{error || task.error}</div>
      {stale ? <p className="listing-note is-warn" role="alert">记录已在其他位置更新，请重新打开。当前文案仍可复制。</p> : null}
      {r.listingDraft && (r.listingDraft.photoRevision !== (r.photoRevision ?? 0) || listingContextChanged(r))
        ? <p className="listing-note is-warn">资料或照片已变更，旧文案已保留，请重新生成。</p> : null}
      {task.busy ? <div role="status" aria-live="polite">
        <ListingSteps steps={[{label: '整理资料', done: progress !== 'preparing'},
          {label: '核对实物', done: !!analysis}, {label: '生成文案', done: false}]}/>
        <p className="listing-note">{phaseText}</p>
      </div> : null}
      {!ready && provider ? <p className="listing-note">{provider.textReady && r.photoCount
        ? '当前模型仅支持文字；请在设置中选择支持图片的模型。' : '请先在 设置 → 账户 → 已连接服务 中连接并选择模型。'}</p> : null}
      <ListingPhotos id={id} count={r.photoCount} revision={r.photoRevision ?? 0} files={photos.files}
        disabled={stale} error={photos.error} retry={photos.retry}/>
      <ListingOptions value={preferences} busy={busy || stale} supplement={supplement}
        onSupplement={value => {setSupplement(value); markDirty(false);}}
        onSave={async value => {
          setSettingsBusy(true);
          try {const next = await api<Preferences>('listing/preferences', value); setPreferences({...next, builtins: value.builtins});}
          finally {setSettingsBusy(false);}
        }}/>
      {shown.analysis ? <Details className="listing-options" summary="核对与依据" open={reviewOpen} onOpenChange={setReviewOpen}>
        <ListingReview draft={shown} onReanalyze={!stale && ready && !busy ? () => generate(true) : undefined}/>
      </Details> : null}
      <Details className="listing-options" summary="已发布？记录平台与链接">
        <fieldset className="listing-fields" disabled={stale || busy || !!candidate}>
          <Field label="上架平台（选填）" name="listing-channel" value={channel} maxLength={100}
            onChange={e => {setChannel(e.target.value); markDirty();}}/>
          <Field label="商品链接（选填）" name="listing-url" type="url" value={url} maxLength={2000}
            onChange={e => {setUrl(e.target.value); markDirty();}}/>
          <button type="button" onClick={() => {void run(app,
            () => api('listing/draft', {id, revision, draft, markListed: true, listing: {channel, url}}),
            '已保存并标记上架', {backOnSave: true});}}>保存并标记上架</button>
        </fieldset>
      </Details>
    </div>
    </div>
    <div className="drawer-footer listing-footer">
      {r.photoCount ? <PhotoDownload id={id} count={r.photoCount} revision={r.photoRevision ?? 0} artist={r.artist} title={r.title}
        variant="button" label="保存图片" preparedFiles={photos.files} disabled={stale}/> : null}
      {shown.description.trim() ? <CopyButton variant="button" label="复制文案" text={[shown.title, shown.description].filter(Boolean).join('\n\n')}/>
        : <button type="button" className="primary" aria-busy={task.busy} disabled={busy || stale || !ready || !preferences}
          onClick={() => generate()}>{task.busy ? phaseText : 'AI 生成上架资料'}</button>}
    </div>
  </form>;
}
