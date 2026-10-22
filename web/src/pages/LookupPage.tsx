// 查询：按条码 / 唱片编号查发行版资料，只读、不入库；库里已有的先列出，需要时再「以此入库」。
// 外部检索沿用 /api/catalog/*（MusicBrainz 优先，Discogs 备用，精确匹配，不按标题猜）。
import {useEffect, useRef, useState} from 'react';
import {LOOKUP_QUEUED, takeLookup} from '../core/lookup-handoff';
import {useApp} from '../state/AppContext';
import {PageHead} from '../components/PageHead';
import {api} from '../core/api';
import {Thumb} from '../components/Cover';
import {displayReleaseTitle} from '../core/release-metadata';
import {statusName} from '../core/modules';
import {classify, isTextQuery, localMatches, loadRecent, pushRecent, saveRecent, type LookupKind} from '../core/lookup';
import {failedSources} from '../forms/record/pickRelease';
import {openDetail} from '../forms/DetailDrawer';
import {openRecordForm} from '../forms/RecordForm';
import type {AlbumRecord, ReleaseCandidate, ReleaseInfo} from '../types';
import {LookupCard} from './LookupCard';
import {AlbumResults, type AlbumHit} from './AlbumResults';
import {PendingReleases} from './PendingReleases';
import {confirmRelease, markHandled} from './confirmRelease';
import {BarcodeScanner, ScanField} from '../components/BarcodeScanner';
import './LookupPage.css';

interface Found {kind: LookupKind | 'text'; value: string; candidates: ReleaseCandidate[]; albums: AlbumHit[]; note: string}

export function LookupPage() {
  const app = useApp();
  const {state, modules} = app;
  const [text, setText] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [recent, setRecent] = useState(loadRecent);
  const [target, setTarget] = useState<AlbumRecord | null>(null);  // 正在为库里这张确认发行版
  const abort = useRef<AbortController | null>(null);

  const search = async (input = text, fallback = '') => {
    const wantText = isTextQuery(input);
    const parsed = wantText ? ({ok: true, kind: 'text', value: input.trim()} as const) : classify(input);
    if (!parsed.ok) { setError(parsed.error); setFound(null); return; }
    abort.current?.abort();
    const controller = abort.current = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 70000);
    setText(input); setError(''); setFound(null); setBusy(true);
    try {
      const opts = {signal: controller.signal};
      let query = parsed.value, kind: Found['kind'] = parsed.kind, note = '', candidates: ReleaseCandidate[] = [], albums: AlbumHit[] = [];
      if (parsed.kind !== 'text') {
        const result = await api<{candidates: ReleaseCandidate[]; sources?: Record<string, string>}>(
          parsed.kind === 'barcode' ? 'catalog/barcode' : 'catalog/number',
          parsed.kind === 'barcode' ? {barcode: parsed.value} : {catalogNumber: parsed.value}, opts);
        candidates = result.candidates; note = failedSources(result.sources);
        // 编号没有精确匹配：不是编号的话，按文字再找一次
        if (!candidates.length && parsed.kind === 'catalog' && /[a-z]{3}/i.test(parsed.value)) kind = 'text';
        // 为库里某张确认版本时，条码查不到就改用它的专辑名 + 艺人做文字搜索
        if (!candidates.length && fallback) { kind = 'text'; query = fallback; }
      }
      if (kind === 'text') {
        const result = await api<{albums: AlbumHit[]; sources?: Record<string, string>}>(
          'catalog/search', {text: query}, opts);
        albums = result.albums; note = failedSources(result.sources);
      }
      if (abort.current !== controller) return;
      if (query !== parsed.value) setText(query);
      setFound({kind, value: query, candidates, albums, note});
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
  const addToLibrary = async (candidate: ReleaseCandidate, info: ReleaseInfo) => {
    if (!target) { openRecordForm(app, undefined, {...candidate, releaseInfo: info}); return; }
    if (await confirmRelease(app, target, candidate, info)) { setTarget(null); setFound(null); setText(''); }
  };
  /** 从「待确认」点一张：有条码按条码查，没有就用专辑名 + 艺人做文字搜索。 */
  const startConfirm = (r: AlbumRecord) => {
    setTarget(r);
    const code = (r.releaseInfo?.barcode || '').replace(/\D/g, '');
    const named = `${displayReleaseTitle(r.title)} ${r.artist}`;
    void search(code.length >= 8 ? code : named, named);
  };

  // 照片灯箱识别出的条码：挂载时取一次；已在本页时靠事件接手
  const searchRef = useRef(search);
  searchRef.current = search;
  useEffect(() => {
    const pickUp = () => { const code = takeLookup(); if (code) void searchRef.current(code); };
    pickUp();
    window.addEventListener(LOOKUP_QUEUED, pickUp);
    return () => window.removeEventListener(LOOKUP_QUEUED, pickUp);
  }, []);

  const local = found && found.kind !== 'text' ? localMatches(state.records, found.kind, found.value) : [];
  const ownedNote = local.length
    ? `已有 ${local.length} 张（${local.map(r => statusName(r.status, modules)).join('、')}）` : '还没有';
  const what = found?.kind === 'barcode' ? '条码' : '编号';
  const isText = found?.kind === 'text';
  return <>
    <PageHead title="查询" label="LOOKUP" desc="按条码、唱片编号或专辑名 / 艺人名查发行版资料，不会入库"/>
    <div className="lookup-page">
      <form className="lookup-form" onSubmit={e => { e.preventDefault(); void search(); }}>
        <ScanField onScan={() => setScanning(true)}
          onClear={text ? () => { abort.current?.abort(); setText(''); setError(''); setFound(null); setBusy(false); setTarget(null); } : undefined}>
          <input type="text" inputMode="text" autoComplete="off" enterKeyHint="search" aria-label="条码、唱片编号或专辑名"
            placeholder="条形码、唱片编号，或专辑名 艺人" value={text}
            onChange={e => { setText(e.target.value); setError(''); }}/>
        </ScanField>
        <button type="submit" className="primary" aria-busy={busy} disabled={busy}>{busy ? '查询中…' : '查询'}</button>
      </form>
      {target ? <div className="lookup-target" role="status">
        <span>正在为「{displayReleaseTitle(target.title)}」确认发行版</span>
        <button type="button" onClick={async () => { if (await markHandled(app, target)) { setTarget(null); setFound(null); } }}>查不到，标为已处理</button>
        <button type="button" className="quiet" onClick={() => setTarget(null)}>取消</button>
      </div> : null}
      {scanning ? <BarcodeScanner onDetect={code => { setScanning(false); void search(code); }} onClose={() => setScanning(false)}/> : null}
      {error ? <p className="lookup-msg is-error" role="alert">{error}</p> : null}
      {!found && !busy && !error && recent.length ? <div className="lookup-recent">
        <span>最近查过</span>
        {recent.map(item => <button key={item} type="button" className="chip" onClick={() => void search(item)}>{item}</button>)}
        <button type="button" className="quiet" onClick={() => { setRecent([]); saveRecent([]); }}>清除</button>
      </div> : null}
      {busy ? <p className="lookup-msg" role="status">查询中 · MusicBrainz，无结果时转 Discogs</p> : null}
      {!found && !busy && !error ? <PendingReleases onPick={startConfirm}/> : null}
      {found && isText ? <section aria-label="专辑搜索结果" className="lookup-results">
        <h2>{found.albums.length ? `找到 ${found.albums.length} 张专辑，点开看版本` : '没有找到相近的专辑'}</h2>
        {found.note ? <p className="lookup-msg">{found.note} 暂不可用，结果可能不全</p> : null}
        <AlbumResults albums={found.albums} records={state.records} confirming={!!target} onAdd={addToLibrary}/>
      </section> : null}
      {found && !isText ? <>
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
          <ul>{found.candidates.map(c => <LookupCard key={c.id} c={c} owned={ownedNote} confirming={!!target}
            onAdd={info => addToLibrary(c, info)}/>)}</ul>
        </section>
      </> : null}
    </div>
  </>;
}
