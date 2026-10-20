// 查询结果卡片：基本信息一直显示，点「详情」再取曲目与完整资料（按需请求，不白占来源限速）；
// 可复制整理好的文字，或带一句提问的版本，直接贴给 AI。
import {useState} from 'react';
import {useApp} from '../state/AppContext';
import {api} from '../core/api';
import {copyText} from '../core/clipboard';
import {dedupeCatalog} from '../core/release-metadata';
import {releaseLabels} from '../core/release-text';
import {askText, releaseText} from '../core/lookup-text';
import {Tracklist} from '../components/Tracklist';
import type {ReleaseCandidate, ReleaseInfo} from '../types';
import './LookupCard.css';

const HIDDEN = new Set(['observations', 'matrix', 'extras']);

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
  const rows = releaseLabels.filter(([key]) => !HIDDEN.has(key) && typeof info[key] === 'string' && info[key]);

  return <li className="lookup-card">
    <div className="lc-main"><strong>{c.title}</strong><span>{c.artist}</span></div>
    <div className="lc-chips">
      {[c.releaseInfo.label, dedupeCatalog(c.releaseInfo.catalogNumber), c.releaseInfo.barcode,
        c.releaseInfo.country, c.releaseInfo.releaseDate, c.source === 'discogs' ? 'Discogs' : 'MusicBrainz']
        .filter(Boolean).map(t => <span key={t} className="lc-chip">{t}</span>)}
    </div>
    {open ? <div className="lc-detail">
      {busy ? <p className="lookup-msg" role="status">读取详情中…</p> : null}
      {error ? <p className="lookup-msg">{error}</p> : null}
      <dl>{rows.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{String(info[key])}</dd></div>)}</dl>
      <Tracklist releaseInfo={info}/>
    </div> : null}
    <div className="lc-actions">
      <button type="button" className="lc-quiet" aria-expanded={open} onClick={toggle}>{open ? '收起详情' : '详情'}</button>
      <button type="button" className="lc-quiet" onClick={() => void copy(false)} disabled={busy}>复制资料</button>
      <button type="button" className="lc-quiet" onClick={() => void copy(true)} disabled={busy}>复制为提问</button>
      {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer">来源</a> : null}
      <button type="button" className="lc-add" onClick={async () => onAdd(await load())} disabled={busy}>
        {busy ? '读取中…' : '以此入库'}
      </button>
    </div>
  </li>;
}
