import {displayReleaseTitle} from '../core/release-metadata';
// 库存卡片与网格：同一专辑（标题+艺人相同）的副本聚成一组。
// wrap 网格里副本组跨列 = min(副本数, 网格列数)，subgrid 保证与相邻卡片同宽；
// 分组横滑行（flex，见 shelf.css）没有列轨道，副本组改用 --n 定宽。
import {useLayoutEffect, useMemo, useRef} from 'react';
import type {ReactNode} from 'react';
import type {AlbumRecord} from '../types';
import {norm} from '../core/search';
import {copyEditionLabel} from '../core/copy-edition';
import {ArtistButton} from './ArtistButton';
import {AlbumSummary} from './AlbumSummary';
import {CamIco} from './icons';
import {Cover, PriceCell} from './Cover';
import {useApp} from '../state/AppContext';

export function AlbumCard({r, page, checked, onSelect, onDetail, onArtist, actions}: {
  r: AlbumRecord; page: string; checked: boolean;
  onSelect?: (id: string, on: boolean) => void;
  onDetail: (id: string) => void;
  onArtist?: (artist: string) => void;
  actions: ReactNode;
}) {
  const {modules, shelfView} = useApp();
  const tags = [copyEditionLabel(r.pressing, r.obi), r.version].filter(Boolean);
  const badges = <>
    {modules.trading && r.listed && page !== 'trash' ? <span className="badge listed">已上架</span> : null}
    {!modules.circulation && r.status === 'transit' ? <span className="badge transit">历史在途</span> : null}
    {r.cover ? null : <span className="badge nocover">待抓取</span>}
  </>;
  if (shelfView === 'list') return <article className="card album-list-card" data-id={r.id}>
    <AlbumSummary r={r} onDetail={() => onDetail(r.id)} onArtist={onArtist}
      coverOverlay={<>
        {page !== 'trash' && onSelect ? <label className="card-check">
          <input type="checkbox" checked={checked} aria-label={`选择 ${r.title}`}
            onChange={e => onSelect(r.id, e.target.checked)}/>
        </label> : null}
        {r.photoCount ? <span className="photo-flag" title={`有 ${r.photoCount} 张实物照片`}>{CamIco}{r.photoCount}</span> : null}
      </>}
      metadata={<>
        <div className="list-badges">{badges}</div>
      </>}
      money={modules.acquisition ? <><small>买入</small><div className="album-purchase"><PriceCell r={r}/></div></> : undefined}
      actions={<div className="card-actions">{actions}</div>}/>
  </article>;
  return (
    <article className="card" data-id={r.id}>
      <div className="cover-wrap">
        <div className="card-badges">
          {modules.circulation && page === 'overseas' ? <span className="badge overseas">海外</span> : null}
          {badges}
        </div>
        {page !== 'trash' && onSelect ? (
          <label className="card-check">
            <input type="checkbox" checked={checked} aria-label={`选择 ${r.title}`}
                   onChange={e => onSelect(r.id, e.target.checked)}/>
          </label>
        ) : null}
        {r.photoCount ? (
          <span className="photo-flag" title={`有 ${r.photoCount} 张实物照片`}>{CamIco}{r.photoCount}</span>
        ) : null}
        <Cover r={r}/>
      </div>
      <div className="card-body">
        <button className="card-title" onClick={() => onDetail(r.id)}>{displayReleaseTitle(r.title)}</button>
        <div className="card-artist">{onArtist ? <ArtistButton artist={r.artist} onOpen={onArtist}/> : r.artist}</div>
        <div className="list-badges">{badges}</div>
        {tags.length ? (
          <div className="card-tags">{tags.map(t => <span key={t} className="card-edt">{t}</span>)}</div>
        ) : null}
        {modules.acquisition ? <div className="card-price"><PriceCell r={r}/></div> : null}
      </div>
      <div className="card-actions">{actions}</div>
    </article>
  );
}

// 网格：副本分组 + 跨列修正（窗口宽度变化会改变列数，随 resize 重算）
export function CardGrid({records, renderCard}: {
  records: AlbumRecord[]; renderCard: (r: AlbumRecord) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const runs = useMemo(() => {
    const map = new Map<string, AlbumRecord[]>();
    for (const r of records) {
      const k = norm(r.title) + '␟' + norm(r.artist);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.values()];
  }, [records]);

  useLayoutEffect(() => {
    const fix = () => {
      const g = ref.current;
      if (!g) return;
      const groups = [...g.querySelectorAll<HTMLElement>('.copy-group')];
      // 横滑行（flex）没有列数概念，副本组直接按副本数定宽。
      // 两种模式都先解除旧定位再测量：布局切换时旧 span / 旧 --n 会污染读数。
      let hrow = false;
      try { hrow = getComputedStyle(g).display === 'flex'; } catch { /* 无样式时兜底 */ }
      if (hrow) {
        groups.forEach(cg => {
          cg.style.gridColumn = '';
          cg.style.setProperty('--n', String(Math.max(1, cg.children.length)));
        });
        return;
      }
      groups.forEach(cg => { cg.style.gridColumn = 'span 1'; cg.style.setProperty('--n', ''); });
      let cols = 3;
      try { cols = getComputedStyle(g).gridTemplateColumns.split(' ').length; } catch { /* 无样式时兜底 */ }
      groups.forEach(cg => {
        cg.style.gridColumn = `span ${Math.max(1, Math.min(cg.children.length, cols))}`;
      });
    };
    fix();
    window.addEventListener('resize', fix);
    return () => window.removeEventListener('resize', fix);
  });

  return (
    <div className="grid" ref={ref}>
      {runs.map(run => run.length > 1 ? (
        <div className="copy-group" key={run[0].id} title="同一专辑的多张副本">
          {run.map(renderCard)}
        </div>
      ) : run.map(renderCard))}
    </div>
  );
}
