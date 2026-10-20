// 上架资料与售卖草稿：按「分析照片 → 核对版本与品相 → 生成文案」三步排列，顶部进度条显示做到哪一步。
// 准备/保存草稿不改变上架状态；只有显式按钮才标记上架。
import {useEffect, useRef, useState} from 'react';
import {api} from '../core/api';
import {draftFor, saleDescription} from '../core/listing';
import type {ListingAnalysis, ListingProvider} from '../core/listing';
import {useApp} from '../state/AppContext';
import type {AppCtx} from '../state/AppContext';
import {Field, TextareaField} from './fields';
import {useFormSubmit} from './shared';
import {ListingReview} from '../components/ListingReview';
import {ListingSteps} from '../components/ListingSteps/ListingSteps';
import './ListingForm.css';

export function openListingForm(app: AppCtx, id: string) {
  app.openDrawer({title: '售卖与上架资料', asForm: true, content: <ListingForm id={id}/>});
}

function ListingForm({id}: {id: string}) {
  const app = useApp();
  const currentRecord = app.rec(id)!;
  const r = useRef(currentRecord).current; // 草稿与选图始终绑定打开时的版本，不能借刷新绕过并发冲突。
  const stale = currentRecord.revision !== r.revision;
  const [channel, setChannel] = useState(r.listingChannel || '');
  const [url, setUrl] = useState(r.listingUrl || '');
  const [draft, setDraft] = useState(() => draftFor(r));
  const [provider, setProvider] = useState<ListingProvider>();
  const [analyzing, setAnalyzing] = useState(false);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const {error, saving, run, setError} = useFormSubmit();
  useEffect(() => {
    const abort = new AbortController();
    api<ListingProvider>('listing/status', undefined, {signal: abort.signal}).then(setProvider)
      .catch(e => {if (!abort.signal.aborted) setError(e.message);});
    return () => {abort.abort(); request.current?.abort(); window.clearTimeout(timer.current);};
  }, []);
  const change = (value: typeof draft) => {setDraft(value); app.setDrawerDirty(true);};
  const analyze = async () => {
    request.current?.abort();
    const abort = new AbortController(); request.current = abort;
    setAnalyzing(true); setError('');
    const fail = (e: unknown) => {
      if (!abort.signal.aborted) {setError(e instanceof Error ? e.message : '分析失败'); setAnalyzing(false);}
    };
    try {
      const job = await api<{id: string}>('listing/analyze', {id, revision: r.revision, photoRevision: r.photoRevision ?? 0}, {signal: abort.signal});
      const poll = async () => {
        try {
          const result = await api<{status: string; error?: string; analysis?: ListingAnalysis}>(`listing/job?id=${job.id}`, undefined, {signal: abort.signal});
          if (result.status === 'running') {timer.current = window.setTimeout(() => {void poll();}, 1500); return;}
          setAnalyzing(false);
          if (result.status === 'failed') throw new Error(result.error);
          if (result.analysis) {
            setDraft(current => ({...current, analysis: result.analysis, versionConfirmed: false, conditionConfirmed: false}));
            app.setDrawerDirty(true);
          }
        } catch (e) {fail(e);}
      };
      await poll();
    } catch (e) {fail(e);}
  };
  const ready = provider?.ready;
  const bothConfirmed = draft.versionConfirmed && draft.conditionConfirmed;
  const facts = draft.analysis;
  return <form onSubmit={e => {
    e.preventDefault();
    void run(app, () => api('listing/draft', {id, revision: r.revision, draft, listing: {channel, url}}), '售卖草稿已保存', {backOnSave: true});
  }}>
    <div className="drawer-body">
      <ListingSteps steps={[
        {label: '分析照片', done: !!facts},
        {label: '核对版本与品相', done: bothConfirmed},
        {label: '生成文案', done: !!draft.description.trim()},
      ]}/>
      <div className="error" role="alert">{error}</div>
      {stale ? <p className="listing-note is-warn" role="alert">记录已在其他位置更新，请关闭后重新打开。当前文案仍可复制。</p> : null}
      {r.listingDraft && r.listingDraft.photoRevision !== (r.photoRevision ?? 0)
        ? <p className="listing-note is-warn" role="status">照片已变更；已保留手写文案，请重新分析并核对。</p> : null}

      <section className="listing-card listing-analyze" aria-label="分析照片">
        <h4>分析本副本照片</h4>
        <p className="small-note">{!r.photoCount ? '这张副本还没有实物照片，先在编辑里添加照片。'
          : facts ? `已识别标识 ${facts.identifiers.length} 项、可见品相 ${facts.observations.length} 项；照片更新后可重新分析。`
            : `共 ${r.photoCount} 张照片。分析只给出带照片编号的线索，最终由你核对。`}</p>
        <button type="button" className={facts ? '' : 'primary'} disabled={stale || !r.photoCount || analyzing || !ready}
                onClick={() => {void analyze();}}>
          {analyzing ? '正在分析照片与查询版本…' : facts ? '重新分析' : '开始分析'}</button>
        {!ready ? <p className="listing-note">请先在 设置 → 高级 → 售卖照片识别 中连接模型；也可以跳过分析，直接手写核对。</p> : null}
      </section>

      <ListingReview draft={draft} onChange={change}/>

      <section className="listing-card listing-copy" aria-label="售卖文案">
        <h4>售卖文案</h4>
        <Field label="售卖标题" name="listing-title" value={draft.title} maxLength={500}
          onChange={e => change({...draft, title: e.target.value})}/>
        <TextareaField label="售卖正文" name="listing-description" value={draft.description}
          onChange={description => change({...draft, description})}/>
        <div className="listing-actions">
          <button type="button" className={bothConfirmed ? 'primary' : ''} disabled={!bothConfirmed} onClick={() => {
            if (draft.description.trim() && !window.confirm('重新生成会替换当前正文，是否继续？')) return;
            change({...draft, description: saleDescription(draft)});
          }}>用已确认信息生成正文</button>
          <button type="button" disabled={!draft.description} onClick={async () => {
            try {await navigator.clipboard.writeText([draft.title, draft.description].filter(Boolean).join('\n\n'));app.toast('售卖文案已复制');}
            catch {app.toast('复制失败，可选中文案手动复制','warn');}
          }}>复制售卖文案</button>
        </div>
        {!bothConfirmed ? <p className="small-note">先在上面确认版本与品相，才能生成正文。</p> : null}
        <p className="small-note">在闲鱼手动发布；照片在专辑详情“实物照片”右侧图标保存。保存草稿不会标记上架。</p>
      </section>

      <details className="listing-publish"><summary>已发布？记录平台与链接</summary>
        <Field label="上架平台（选填）" name="listing-channel" value={channel} maxLength={100}
          placeholder="例如：闲鱼" onChange={e => {setChannel(e.target.value);app.setDrawerDirty(true);}}/>
        <Field label="商品链接（选填）" name="listing-url" type="url" value={url} maxLength={2000}
          placeholder="https://…" onChange={e => {setUrl(e.target.value);app.setDrawerDirty(true);}}/>
        <button type="button" disabled={stale || saving || analyzing} onClick={() => {void run(app,
          () => api('listing/draft', {id, revision: r.revision, draft, markListed: true, listing: {channel, url}}),
          '已保存并标记上架', {backOnSave: true});}}>保存并标记上架</button>
      </details>
    </div>
    <div className="drawer-footer">
      <button type="button" onClick={() => app.backDrawer()}>取消</button>
      <button type="submit" className="primary" disabled={stale || saving || analyzing}>保存草稿</button>
    </div>
  </form>;
}
