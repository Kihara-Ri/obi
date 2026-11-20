// 艺人候选确认：查找中 / 候选列表（含同名提示、搜索名称、确认区送进抽屉底栏）/ 未找到 / 无法连接。
import {useState} from 'react';
import {createPortal} from 'react-dom';
import {artistTypeText, strictTitle} from '../core/artists';
import type {ArtistCandidate, ResolveResult} from '../core/artists';

export interface ArtistResolutionProps {
  artist: string;
  resolution: {phase: 'loading' | 'candidates' | 'not_found' | 'unavailable'; data?: ResolveResult; error?: string};
  footerTarget?: HTMLElement | null;
  busy: string | null;
  onPickCandidate(candidate: ArtistCandidate): void;
  onSearchName(name: string): void;
  onRetry(): void;
}

function SearchRow({id, label, value, busy, onChange, onSearch}: {
  id?: string; label?: string; value: string; busy: boolean; onChange(v: string): void; onSearch(): void;
}) {
  return (
    <div className="candidate-search-row">
      <input id={id} aria-label={id ? undefined : label} value={value} maxLength={500}
             placeholder="输入要搜索的名称" onChange={e => onChange(e.target.value)}/>
      <button type="button" disabled={!value.trim() || busy} onClick={onSearch}>搜索</button>
    </div>
  );
}

export function ArtistResolution({artist, resolution, footerTarget, busy, onPickCandidate, onSearchName, onRetry}: ArtistResolutionProps) {
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const candidates = resolution.data?.candidates ?? [];
  const nameCounts = new Map<string, {name: string; count: number}>();
  for (const c of candidates) {
    const key = strictTitle(c.name), entry = nameCounts.get(key);
    nameCounts.set(key, {name: entry?.name ?? c.name, count: (entry?.count ?? 0) + 1});
  }
  const homonyms = [...nameCounts.values()].filter(e => e.count > 1);
  const selected = candidates.find(c => c.mbid === candidateId) ?? null;
  const search = <SearchRow label="调整搜索名称" value={name} busy={busy === 'resolve'} onChange={setName} onSearch={() => onSearchName(name.trim())}/>;

  const confirmation = selected ? (
    <div className="candidate-confirm">
      <p>将库内 <b>{artist}</b> 对应到资料库 <b>{selected.name}</b>{selected.disambiguation ? `（${selected.disambiguation}）` : ''}</p>
      <p className="small-note">确认后，作品目录按这位艺人的身份读取；本地记录名称不变。</p>
      <button type="button" className="primary" disabled={busy === 'bind'} onClick={() => onPickCandidate(selected)}>确认艺人</button>
    </div>
  ) : null;

  return (
    <section className="profile-resolution">
      {resolution.phase === 'loading' ? <p className="profile-note">正在查找艺人资料…</p> : null}
      {resolution.phase === 'candidates' && resolution.data ? (
        <>
          <h4 className="profile-resolution-title" role="status">{candidates.length === 1 ? '找到 1 位候选' : `找到 ${candidates.length} 位候选`}</h4>
          {homonyms.map(e => <p className="small-note" key={e.name}>其中 {e.count} 位以「{e.name}」同名收录。</p>)}
          <p className="profile-note">{candidates.length === 1 ? '唯一候选将自动采用。' : '本地专辑暂时无法确定唯一艺人，请选择对应的资料。'}</p>
          {resolution.data.searchCount && resolution.data.searchCount > candidates.length
            ? <p className="small-note">来源共返回 {resolution.data.searchCount} 个结果，当前显示前 {candidates.length} 位。</p> : null}
          {!resolution.data.evidenceComplete ? <p className="small-note">专辑核对或来源结果尚不完整。</p> : null}
          <ul className="candidate-list">
            {candidates.map(c => (
              <li key={c.mbid}>
                <label className={`candidate${candidateId === c.mbid ? ' on' : ''}`}>
                  <input type="radio" name="artist-candidate" value={c.mbid}
                         checked={candidateId === c.mbid} onChange={() => setCandidateId(c.mbid)}/>
                  <span className="candidate-main">
                    <b>{c.name}</b>
                    <small>{[artistTypeText(c.type), c.area, c.disambiguation].filter(Boolean).join(' · ') || '暂无地区与类型资料'}</small>
                    <small className="candidate-evidence">{c.hasEvidence === true ? '本地专辑有对应作品' : c.hasEvidence === false ? '未找到本地专辑对应' : '专辑尚未核对'}</small>
                  </span>
                </label>
                <a className="candidate-source" href={`https://musicbrainz.org/artist/${c.mbid}`}
                   target="_blank" rel="noopener noreferrer" aria-label={`核对 ${c.name} 的 MusicBrainz 资料`}>核对来源 ↗</a>
              </li>
            ))}
          </ul>
          <div className="candidate-search">
            <label className="small-note" htmlFor="artist-search-name">名称不符？调整搜索名称（不写回本地记录）</label>
            <SearchRow id="artist-search-name" value={name} busy={busy === 'resolve'} onChange={setName} onSearch={() => onSearchName(name.trim())}/>
          </div>
          {confirmation ? (footerTarget ? createPortal(confirmation, footerTarget) : confirmation) : null}
        </>
      ) : null}
      {resolution.phase === 'not_found' ? (
        <div className="profile-empty">
          <p>资料库暂未找到该艺人。</p>
          <p className="small-note">本地收藏不受影响；可调整名称重新搜索。</p>
          {search}
        </div>
      ) : null}
      {resolution.phase === 'unavailable' ? (
        <div className="profile-empty">
          <p role="alert">暂时无法连接资料库。</p>
          <p className="small-note">本地收藏仍可使用。</p>
          <button type="button" onClick={onRetry}>重试</button>
        </div>
      ) : null}
    </section>
  );
}
