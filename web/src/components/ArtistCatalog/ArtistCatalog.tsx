// 艺人作品目录：「作品」标题 + 只看已收藏 + 胶囊分类（带数量）+ 读取进度 + 作品列表。
// 手机为列表行，桌面为封面网格（点开的作品占满一行）。
import {useState} from 'react';
import {CATEGORY_LABELS, CATEGORY_ORDER} from '../../core/artists';
import type {ArtistWork, CatalogCategory} from '../../core/artists';
import {ArtistWorkItem} from './ArtistWorkItem';
import type {SuggestionRow, WorkItemShared, WorkLinkRow} from './ArtistWorkItem';
import './ArtistCatalog.css';

export interface ArtistCatalogProps {
  works: ArtistWork[];
  complete: boolean;
  progress: {loaded: number; total: number | null; refreshing: boolean} | null;
  pageError: string | null;
  category: CatalogCategory;
  expanded: string | null;
  linkedByWork: Map<string, WorkLinkRow[]>;
  suggestions: Map<string, SuggestionRow>;
  item: WorkItemShared;
  onCategory(v: CatalogCategory): void;
  onRetryPage(): void;
}

const CheckIco = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>;

export function ArtistCatalog(props: ArtistCatalogProps) {
  const {works, complete, progress, pageError, category, expanded, linkedByWork, suggestions, item} = props;
  const [ownedOnly, setOwnedOnly] = useState(false);
  const owned = (w: ArtistWork) => !!linkedByWork.get(w.mbid)?.length || suggestions.has(w.mbid);
  const inCategory = works.filter(w => w.category === category);
  const shown = ownedOnly ? inCategory.filter(owned) : inCategory;
  const ownedCount = works.filter(owned).length;

  return (
    <section className="profile-catalog" aria-label="作品">
      <div className="catalog-head">
        <h4 className="catalog-title">作品{complete ? <small>{works.length}</small> : null}</h4>
        <button type="button" className={`catalog-owned${ownedOnly ? ' on' : ''}`} aria-pressed={ownedOnly}
                disabled={!ownedCount && !ownedOnly} onClick={() => setOwnedOnly(v => !v)}>
          {CheckIco}只看已收藏{ownedCount ? ` ${ownedCount}` : ''}
        </button>
      </div>
      <div className="artist-cats" role="tablist" aria-label="作品分类">
        {CATEGORY_ORDER.map(c => (
          <button key={c} type="button" role="tab" aria-selected={category === c}
                  className={`artist-cat${category === c ? ' on' : ''}`} onClick={() => props.onCategory(c)}>
            {CATEGORY_LABELS[c]}<b>{works.filter(w => w.category === c).length}{complete ? '' : '+'}</b>
          </button>
        ))}
      </div>
      {progress ? (
        <p className="profile-note" role="status">
          {progress.refreshing ? '正在更新资料…' : '正在读取作品…'}
          已读取 {progress.loaded} / {progress.total ?? '？'} 项作品
        </p>
      ) : null}
      {pageError ? (
        <p className="profile-banner err" role="alert">
          {pageError} <button type="button" className="quiet" onClick={props.onRetryPage}>重试</button>
        </p>
      ) : null}
      {!progress && !pageError && !complete && !works.length ? <p className="profile-note">正在读取作品…</p> : null}
      {shown.length ? (
        <ul className="work-list">
          {shown.map(w => (
            <ArtistWorkItem key={w.mbid} {...item} work={w} rows={linkedByWork.get(w.mbid) ?? []}
                            suggestion={suggestions.get(w.mbid)} open={expanded === w.mbid}/>
          ))}
        </ul>
      ) : complete || ownedOnly ? (
        <p className="profile-note">{ownedOnly ? '这个分类里还没有收藏。' : '当前分类暂无收录作品。'}</p>
      ) : null}
    </section>
  );
}
