// 查询：按条码 / 唱片编号查发行版资料，只读、不入库；库里已有的先列出，需要时再「以此入库」。
// 外部检索沿用 /api/catalog/*（MusicBrainz 优先，Discogs 备用，精确匹配，不按标题猜）。
import {useRef, useState} from 'react';
import {useApp} from '../state/AppContext';
import {PageHead} from '../components/PageHead';
import {api} from '../core/api';
import {Thumb} from '../components/Cover';
import {displayReleaseTitle} from '../core/release-metadata';
import {statusName} from '../core/modules';
import {classify, localMatches, loadRecent, pushRecent, saveRecent, type LookupKind} from '../core/lookup';
import {failedSources} from '../forms/record/pickRelease';
import {openDetail} from '../forms/DetailDrawer';
import {openRecordForm} from '../forms/RecordForm';
import type {ReleaseCandidate, ReleaseInfo} from '../types';
import {LookupCard} from './LookupCard';
import {BarcodeScanner} from '../components/BarcodeScanner';
import {CamIco} from '../components/icons';
import './LookupPage.css';

interface Found {kind: LookupKind; value: string; candidates: ReleaseCandidate[]; note: string}

export function LookupPage() {
  const app = useApp();
  const {state, modules} = app;
  const [text, setText] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [recent, setRecent] = useState(loadRecent);
  const abort = useRef<AbortController | null>(null);

  const search = async (input = text) => {
    const parsed = classify(input);
    if (!parsed.ok) { setError(parsed.error); setFound(null); return; }
    abort.current?.abort();
    const controller = abort.current = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 70000);
    setText(input); setError(''); setFound(null); setBusy(true);
    try {
      const body = parsed.kind === 'barcode' ? {barcode: parsed.value} : {catalogNumber: parsed.value};
      const result = await api<{candidates: ReleaseCandidate[]; sources?: Record<string, string>}>(
        parsed.kind === 'barcode' ? 'catalog/barcode' : 'catalog/number', body, {signal: controller.signal});
      if (abort.current !== controller) return;
      setFound({kind: parsed.kind, value: parsed.value, candidates: result.candidates,
        note: failedSources(result.sources)});
      const next = pushRecent(recent, parsed.value); setRecent(next); saveRecent(next);
    } catch (err) {
      if (abort.current !== controller) return;
      setError(controller.signal.aborted ? '查询超时，请稍后重试' : err instanceof Error ? err.message : String(err));
    } finally {
      window.clearTimeout(timer);
      if (abort.current === controller) setBusy(false);
    }
  };

  /** 带入新增表单：详情由卡片取好（取不到时只有基本资料）。 */
  const addToLibrary = (candidate: ReleaseCandidate, info: ReleaseInfo) => {
    openRecordForm(app, undefined, {...candidate, releaseInfo: info});
  };

  const local = found ? localMatches(state.records, found.kind, found.value) : [];
  const ownedNote = local.length
    ? `已有 ${local.length} 张（${local.map(r => statusName(r.status, modules)).join('、')}）` : '还没有';
  const what = found?.kind === 'barcode' ? '条码' : '编号';
  return <>
    <PageHead title="查询" label="LOOKUP" desc="按条码或唱片编号查发行版资料，不会入库"/>
    <div className="lookup-page">
      <form className="lookup-form" onSubmit={e => { e.preventDefault(); void search(); }}>
        <input type="text" inputMode="text" autoComplete="off" enterKeyHint="search" aria-label="条码或唱片编号"
          placeholder="条形码，或唱片编号如 AMCY-2434" value={text}
          onChange={e => { setText(e.target.value); setError(''); }}/>
        <button type="button" className="scan-btn" aria-label="扫描条码" onClick={() => setScanning(true)}>{CamIco}</button>
        <button type="submit" className="primary" disabled={busy}>{busy ? '查询中…' : '查询'}</button>
      </form>
      {scanning ? <BarcodeScanner onDetect={code => { setScanning(false); void search(code); }} onClose={() => setScanning(false)}/> : null}
      {error ? <p className="lookup-msg is-error" role="alert">{error}</p> : null}
      {!found && !busy && !error && recent.length ? <div className="lookup-recent">
        <span>最近查过</span>
        {recent.map(item => <button key={item} type="button" className="chip" onClick={() => void search(item)}>{item}</button>)}
        <button type="button" className="quiet" onClick={() => { setRecent([]); saveRecent([]); }}>清除</button>
      </div> : null}
      {busy ? <p className="lookup-msg" role="status">查询中 · MusicBrainz，无结果时转 Discogs</p> : null}
      {found ? <>
        {local.length ? <section aria-label="库里已有" className="lookup-local">
          <h2>库里已有 {local.length} 张</h2>
          <ul>{local.map(r => <li key={r.id}>
            <button type="button" onClick={() => openDetail(app, r.id)}>
              <Thumb r={r}/>
              <span className="ll-text"><strong>{displayReleaseTitle(r.title)}</strong><span>{r.artist}</span></span>
              <span className={`pill ${r.status}`}>{statusName(r.status, modules)}</span>
            </button>
          </li>)}</ul>
        </section> : <p className="lookup-msg">库里还没有这个{what}</p>}
        <section aria-label="资料库结果" className="lookup-results">
          <h2>{found.candidates.length ? `资料库找到 ${found.candidates.length} 个版本` : '资料库没有精确匹配'}</h2>
          {found.note ? <p className="lookup-msg">{found.note} 暂不可用，结果可能不全</p> : null}
          {!found.candidates.length && !found.note
            ? <p className="lookup-msg">两个资料库都没有这个{what}；不会按标题猜测相似版本。</p> : null}
          <ul>{found.candidates.map(c => <LookupCard key={c.id} c={c} owned={ownedNote}
            onAdd={info => addToLibrary(c, info)}/>)}</ul>
        </section>
      </> : null}
    </div>
  </>;
}
