// 艺人页头部：收藏封面拼成的头像 + 名字与一行摘要 + 收藏数字 + 音乐类型标签。
// 别名点「别名 N」才展开；来源与资料管理收进右上角「⋯」，展开的内容由调用方传入（source）。
import {useState} from 'react';
import type {ReactNode} from 'react';
import {artistTypeText, lifeSpanText} from '../../core/artists';
import type {CollectionRecord, IdentityInfo, ProfileResponse} from '../../core/artists';
import type {ModuleFlags} from '../../types';
import {Collapse} from '../ui/Collapse';
import './ArtistHero.css';

export interface ArtistHeroProps {
  artist: string;
  profile: ProfileResponse['profile'];
  identities: IdentityInfo | null;
  modules: ModuleFlags;
  collection: {counts: {holding: number; shipping: number; sold: number}; records: CollectionRecord[]};
  source: ReactNode;
}

const MoreIco = <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>;

function methodText(method: IdentityInfo['method']) {
  return method === 'manual' ? '已人工确认' : method === 'single' ? '唯一候选，已自动采用' : '已用本地专辑确认';
}

// 有 4 张以上不同封面拼 2×2，否则用第一张；一张都没有时显示名字首字。
function Avatar({name, records}: {name: string; records: CollectionRecord[]}) {
  const covers = [...new Set(records.map(r => r.cover).filter(Boolean))];
  const shown = covers.length >= 4 ? covers.slice(0, 4) : covers.slice(0, 1);
  return (
    <span className={`artist-avatar${shown.length === 4 ? ' mosaic' : ''}`} aria-hidden="true">
      {shown.length ? shown.map(c => <img key={c} src={c} alt="" loading="lazy"/>) : <b>{name.slice(0, 1)}</b>}
    </span>
  );
}

export function ArtistHero({artist, profile, identities, modules, collection, source}: ArtistHeroProps) {
  const [aliasesOpen, setAliasesOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const name = profile?.name || artist;
  const summary = profile ? [
    artistTypeText(profile.type), profile.area,
    ...lifeSpanText(profile.type, profile.lifeSpan).map(([label, value]) => `${label} ${value}`),
  ].filter(Boolean).join(' · ') : '';
  const aliases = profile?.aliases ?? [];
  const genres = profile?.genres ?? [];
  const {counts} = collection;
  const stats: [string, number][] = [['持有', counts.holding],
    ...(modules.trading ? [['售出中', counts.shipping], ['曾收藏', counts.sold]] as [string, number][] : [])];
  const meta = [
    profile?.name && profile.name !== artist ? `收藏里署名为「${artist}」` : null,
    identities ? methodText(identities.method) : null,
  ].filter(Boolean).join(' · ');

  return (
    <section className="artist-hero" aria-label="艺人概况">
      <div className="artist-hero-top">
        <Avatar name={name} records={collection.records}/>
        <div className="artist-hero-text">
          <h3 className="artist-hero-name">{name}</h3>
          {summary ? <p className="artist-hero-summary">{summary}</p> : null}
          {profile?.disambiguation ? <p className="artist-hero-note">{profile.disambiguation}</p> : null}
        </div>
        <button type="button" className="quiet artist-hero-more" aria-label="来源与资料管理" title="来源与资料管理"
                aria-expanded={sourceOpen} onClick={() => setSourceOpen(v => !v)}>{MoreIco}</button>
      </div>
      <Collapse open={sourceOpen}><div className="artist-source">{source}</div></Collapse>
      {meta || profile?.sourceUrl ? (
        <p className="artist-hero-meta">
          {meta}
          {profile?.sourceUrl ? <>{meta ? ' · ' : ''}<a href={profile.sourceUrl} target="_blank" rel="noopener noreferrer">MusicBrainz ↗</a></> : null}
        </p>
      ) : null}
      <dl className="artist-stats" aria-label="我的收藏">
        {stats.map(([label, value]) => (
          <div key={label} className={value ? '' : 'is-zero'}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      {genres.length || aliases.length ? (
        <div className="artist-chips">
          {genres.map(g => <span key={g} className="artist-chip">{g}</span>)}
          {aliases.length ? (
            <button type="button" className="artist-chip artist-chip-toggle" aria-expanded={aliasesOpen}
                    onClick={() => setAliasesOpen(v => !v)}>别名 {aliases.length}</button>
          ) : null}
        </div>
      ) : null}
      {aliases.length ? (
        <Collapse open={aliasesOpen}><p className="artist-aliases">{aliases.join('、')}</p></Collapse>
      ) : null}
    </section>
  );
}
