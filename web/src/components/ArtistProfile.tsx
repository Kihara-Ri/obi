// 艺人资料面板（纯展示）：头部概况与收藏数字、候选确认、作品目录、未关联副本。
// 只接收 props 与回调，不做请求；打开、状态与详情往返由 forms/ArtistDrawer 负责。
// 手机单列；桌面左侧栏放头部，右侧放目录（封面网格）。
import {useState} from 'react';
import {strictTitle} from '../core/artists';
import type {
  ArtistCandidate, ArtistWork, CatalogCategory, CollectionRecord, IdentityInfo,
  ProfileResponse, ResolveResult, SourceState, WorkLinkInfo,
} from '../core/artists';
import {statusName} from '../core/modules';
import type {ModuleFlags} from '../types';
import {Chevron} from './ui/Chevron';
import {ArtistHero} from './ArtistHero/ArtistHero';
import {ArtistSource} from './ArtistHero/ArtistSource';
import {ArtistCatalog} from './ArtistCatalog/ArtistCatalog';
import type {SuggestionRow, WorkLinkRow} from './ArtistCatalog/ArtistWorkItem';
import type {ArtworkGate} from './ArtistCatalog/WorkCover';
import {ArtistResolution} from './ArtistResolution';

export type {ArtworkGate, SuggestionRow, WorkLinkRow};

export interface ArtistProfileProps {
  artist: string;
  footerTarget?: HTMLElement | null;
  modules: ModuleFlags;
  profile: ProfileResponse['profile'];
  identities: IdentityInfo | null;
  identityInvalid: boolean;
  sourceState: SourceState;
  profileLoading: boolean;
  profileError: string | null;
  resolution: {phase: 'loading' | 'candidates' | 'not_found' | 'unavailable'; data?: ResolveResult; error?: string} | null;
  collection: {counts: {holding: number; shipping: number; sold: number}; records: CollectionRecord[]};
  works: ArtistWork[];
  catalogComplete: boolean;
  progress: {loaded: number; total: number | null; refreshing: boolean} | null;
  pageError: string | null;
  category: CatalogCategory;
  workLinks: Record<string, WorkLinkInfo>;
  expanded: string | null;
  linking: boolean;
  onCategory(v: CatalogCategory): void;
  onToggleWork(mbid: string): void;
  onToggleLinker(): void;
  unlinkedInitiallyOpen?: boolean;
  onOpenRecord(id: string, unlinkedOpen?: boolean): void;
  onLink(record: CollectionRecord, work: ArtistWork): void;
  onUnlink(record: CollectionRecord): void;
  onRetryPage(): void;
  onRefresh(): void;
  onChangeArtist(): void;
  onRetryProfile(): void;
  onPickCandidate(candidate: ArtistCandidate): void;
  onSearchName(name: string): void;
  busy: string | null;
  gate: ArtworkGate;
}

export function ArtistProfile(props: ArtistProfileProps) {
  const {
    artist, modules, profile, identities, identityInvalid, profileLoading, profileError,
    resolution, collection, works, workLinks, busy,
  } = props;
  const [unlinkedOpen, setUnlinkedOpen] = useState(props.unlinkedInitiallyOpen ?? false);

  const linkedByWork = new Map<string, WorkLinkRow[]>();
  for (const r of collection.records) {
    const link = workLinks[r.id];
    if (!link) continue;
    linkedByWork.set(link.releaseGroupMbid, [...linkedByWork.get(link.releaseGroupMbid) ?? [], {record: r, link}]);
  }
  const unlinked = collection.records.filter(r => workLinks[r.id]?.state !== 'confirmed');

  // 标题严格匹配且只命中一个作品 → 「可能已收藏」建议（不自动成为确定关联）
  const titleWorkCount = new Map<string, number>();
  for (const w of works) {
    const k = strictTitle(w.title);
    titleWorkCount.set(k, (titleWorkCount.get(k) ?? 0) + 1);
  }
  const suggestions = new Map<string, SuggestionRow>();
  for (const w of works) {
    const k = strictTitle(w.title);
    if (titleWorkCount.get(k) !== 1) continue;
    const rows = collection.records.filter(r => strictTitle(r.title) === k && workLinks[r.id]?.releaseGroupMbid !== w.mbid);
    if (rows.length) suggestions.set(w.mbid, {work: w, records: rows});
  }
  const ready = !!identities && !resolution;
  const openRecord = (id: string) => props.onOpenRecord(id, unlinkedOpen);

  return (
    <div className="artist-profile">
      <div className="artist-workspace">
        <aside className="profile-sidebar" aria-label="艺人概况与收藏">
          <ArtistHero artist={artist} profile={profile} identities={identities} modules={modules} collection={collection}
            source={<ArtistSource sourceState={props.sourceState} manageable={ready} identityInvalid={identityInvalid}
              busy={busy} onRefresh={props.onRefresh} onChangeArtist={props.onChangeArtist} onSearchName={props.onSearchName}/>}/>
          {identityInvalid ? <p className="profile-banner warn" role="alert">资料身份需重新确认，请更换艺人。</p> : null}
          {profileLoading && !profile && !resolution ? <p className="profile-note" role="status">正在读取艺人资料…</p> : null}
          {profileError && !profile ? <p className="profile-banner err" role="alert">
            {profileError} <button type="button" className="quiet" onClick={props.onRetryProfile}>重试</button>
          </p> : null}
          {!profile && !profileLoading && !profileError && !resolution ? <p className="profile-note">该艺人的详细资料暂未收录。</p> : null}
        </aside>
        <div className="profile-content">
          {resolution ? (
            <ArtistResolution artist={artist} resolution={resolution} footerTarget={props.footerTarget} busy={busy}
              onPickCandidate={props.onPickCandidate} onSearchName={props.onSearchName} onRetry={props.onRetryProfile}/>
          ) : null}
          {ready ? (
            <ArtistCatalog works={works} complete={props.catalogComplete} progress={props.progress} pageError={props.pageError}
              category={props.category} expanded={props.expanded} linkedByWork={linkedByWork} suggestions={suggestions}
              onCategory={props.onCategory} onRetryPage={props.onRetryPage}
              item={{modules, unlinked, linking: props.linking, busy, gate: props.gate, onToggleWork: props.onToggleWork,
                onToggleLinker: props.onToggleLinker, onOpenRecord: openRecord, onLink: props.onLink, onUnlink: props.onUnlink}}/>
          ) : null}
          {ready && unlinked.length ? (
            <section className="profile-unlinked">
              <button type="button" className="quiet" aria-expanded={unlinkedOpen} onClick={() => setUnlinkedOpen(v => !v)}>
                未关联的本地副本 · {unlinked.length} 张 <Chevron open={unlinkedOpen}/>
              </button>
              {unlinkedOpen ? (
                <ul className="copy-list">
                  {unlinked.map(r => (
                    <li key={r.id} className="copy-row">
                      <span className="copy-info"><b>{r.title}</b><small>{statusName(r.status, modules)}</small></span>
                      <button type="button" onClick={() => openRecord(r.id)}>详情</button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
