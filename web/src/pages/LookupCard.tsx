// 查询结果卡片：基本信息一直显示，点「详情」再取曲目与完整资料（按需请求，不白占来源限速）；
// 可复制整理好的文字，或带一句提问的版本，直接贴给 AI。
import {useState} from 'react';
import {useApp} from '../state/AppContext';
import {api} from '../core/api';
import {copyText} from '../core/clipboard';
import {dedupeCatalog, regionName} from '../core/release-metadata';
import {askText, releaseText} from '../core/lookup-text';
import {Tracklist} from '../components/Tracklist';
import type {ReleaseCandidate, ReleaseInfo} from '../types';
import './LookupCard.css';

export function LookupCard({c, owned, onAdd}: {
  c: ReleaseCandidate; owned: string; onAdd: (info: ReleaseInfo) => void;
}) {
  const app = useApp();
  const [full, setFull] = useState<ReleaseInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /** 取详情；失败时回退到精确匹配的基本资料，并说明曲目暂不可用。 */
  const load = async (): Promise<ReleaseInfo> => {
    if (full) return full;
    setBusy(true); setError('');
    try {
      const detail = (await api<{releaseInfo: ReleaseInfo}>('release-details?id=' + encodeURIComponent(c.id))).releaseInfo;
      const merged = {...c.releaseInfo, ...detail};
      setFull(merged);
      return merged;
    } catch (err) {
      setError((err instanceof Error ? err.message : String(err)) + '（曲目暂不可用，已显示基本资料）');
      return c.releaseInfo;
    } finally { setBusy(false); }
  };
  const toggle = () => { const next = !open; setOpen(next); if (next) void load(); };
  const copy = async (ask: boolean) => {
    const text = releaseText(c, await load(), owned);
    app.toast(await copyText(ask ? askText(text) : text) ? (ask ? '已复制，连同提问' : '资料已复制') : '复制失败，请手动选择文字', 'warn');
  };
  const info = full ?? c.releaseInfo;
  const base = c.releaseInfo;
  // 摘要里已经有的字段不在详情里重复：详情只补包装、版次说明、介质、碟数与曲目
  const facts: [string, string | undefined][] = [
    ['唱片编号', dedupeCatalog(base.catalogNumber)], ['条码', base.barcode], ['厂牌', base.label],
    ['发行地区', regionName(base.country)], ['发行日', base.releaseDate]];
  const extra: [string, string | undefined][] = [
    ['包装', info.packaging], ['版次说明', info.edition], ['介质', info.format],
    ['碟数', info.discCount ? info.discCount + ' 张' : '']];
  const source = c.source === 'discogs' ? 'Discogs' : 'MusicBrainz';

  return <li className="lookup-card">
    <header className="lc-head">
      <div className="lc-main"><strong>{c.title}</strong><span>{c.artist}</span></div>
      {c.url ? <a className="lc-source" href={c.url} target="_blank" rel="noopener noreferrer"
        aria-label={`在 ${source} 查看`}>{source} ↗</a> : <span className="lc-source">{source}</span>}
    </header>
    <dl className="lc-facts">
      {facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
    </dl>
    <button type="button" className="lc-more" aria-expanded={open} onClick={toggle}>
      <span>曲目与版本资料</span><i aria-hidden="true">{open ? '−' : '+'}</i>
    </button>
    {open ? <div className="lc-detail">
      {busy ? <p className="lookup-msg" role="status">读取详情中…</p> : null}
      {error ? <p className="lookup-msg">{error}</p> : null}
      <dl className="lc-facts">
        {extra.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <Tracklist releaseInfo={info}/>
    </div> : null}
    <div className="lc-actions">
      <button type="button" onClick={() => void copy(false)} disabled={busy}>复制资料</button>
      <button type="button" onClick={() => void copy(true)} disabled={busy}>复制为提问</button>
    </div>
    <button type="button" className="primary lc-add" onClick={async () => onAdd(await load())} disabled={busy}>
      {busy ? '读取中…' : '以此入库'}
    </button>
  </li>;
}
