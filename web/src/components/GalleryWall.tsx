import {useEffect, useMemo, useRef, useState} from 'react';
import type {CSSProperties, KeyboardEvent} from 'react';
import {galleryIndex, GALLERY_ROAMING_DEFAULTS, GALLERY_SPACING_SCALE} from '../core/gallery';
import {labelTags} from '../types';
import type {AlbumRecord} from '../types';
import type {GalleryStageProps} from './GalleryStage';
import {GalleryCase} from './GalleryCase';
import {ArtistButton} from './ArtistButton';
import {useGalleryRoaming, roamGalleryScroller} from './useGalleryRoaming';
import type {GalleryScrollPosition} from './useGalleryRoaming';

/** 封面墙垂直时保持页面原生滚动；瀑布流垂直巡游时各列单独滚动。水平方向下舞台自己是横向滚动容器，巡游推它的 scrollLeft。 */
export function GalleryWall({records, mode, currentId, density, spacing = 'normal', showTitles, axis = 'vertical', roaming = false, roamingSpeed = GALLERY_ROAMING_DEFAULTS[mode],
                             onPick, onFocus, onArtist}: GalleryStageProps) {
  const root = useRef<HTMLDivElement>(null);
  const scrollStates = useRef(new WeakMap<HTMLElement, GalleryScrollPosition>());
  const [columnCount, setColumnCount] = useState(2);
  const [roamViewport, setRoamViewport] = useState(false);
  const horizontal = axis === 'horizontal';
  const viewport = horizontal || roamViewport;
  const index = galleryIndex(records, currentId);
  const columns = useMemo(() => {
    const result: AlbumRecord[][] = Array.from({length: columnCount}, () => []);
    records.forEach((r, i) => result[i % columnCount].push(r)); return result;
  }, [records, columnCount]);
  useEffect(() => {
    const el = root.current; if (!el) return;
    const narrow = () => el.clientWidth < 420;
    const resize = () => {
      const small = narrow();
      const gap = Math.round((small ? 10 : 12) * GALLERY_SPACING_SCALE[spacing]);
      if (horizontal) {
        // 水平：行数由舞台高度决定，格子边长取密度对应的下限再把剩余高度均分
        const minimum = density === 'small' ? small ? 65 : 76 : density === 'large' ? small ? 144 : 176 : small ? 96 : 112;
        const caption = mode === 'waterfall' || showTitles ? 84 : 0;
        const height = el.clientHeight || 360;
        const rows = Math.max(1, Math.min(8, Math.floor((height + gap) / (minimum + caption + gap))));
        const cell = Math.max(48, Math.min(Math.round(minimum * 1.3), Math.floor((height - (rows - 1) * gap - rows * caption) / rows)));
        el.style.setProperty('--axis-rows', String(rows)); el.style.setProperty('--axis-cell', `${cell}px`);
        el.style.setProperty('--axis-gap', `${gap}px`);
        if (mode === 'waterfall') setColumnCount(rows);
        return;
      }
      el.style.removeProperty('--axis-rows'); el.style.removeProperty('--axis-cell'); el.style.removeProperty('--axis-gap');
      if (mode !== 'waterfall') return;
      const minimum = density === 'small' ? small ? 90 : 110
        : density === 'large' ? small ? 174 : 218 : small ? 126 : 146;
      setColumnCount(Math.max(1, Math.min(6, Math.floor((el.clientWidth + gap) / (minimum + gap)))));
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(el);
    return () => observer.disconnect();
  }, [mode, density, spacing, horizontal, showTitles]);
  useEffect(() => {if (roaming) setRoamViewport(true);}, [roaming]);
  useGalleryRoaming(root, roaming && viewport, seconds => {
    const area = root.current; if (!area) return;
    const scrollers = mode === 'waterfall' && !horizontal ? [...area.querySelectorAll<HTMLElement>('.gallery-waterfall-column')] : [area];
    scrollers.forEach((element, i) => {
      let state = scrollStates.current.get(element);
      if (!state) {state = {position: element.scrollTop, painted: element.scrollTop, direction: 1}; scrollStates.current.set(element, state);}
      const cover = element.querySelector<HTMLElement>('.gallery-cover-button');
      const box = cover?.getBoundingClientRect();
      const pitch = ((horizontal ? box?.width : box?.height) || 160) + 24;
      const stagger = mode === 'waterfall' && !horizontal ? [1, 1.18, .92, 1.08, .96, 1.12][i % 6] : 1;
      roamGalleryScroller(element, state, seconds, pitch * stagger / roamingSpeed, horizontal);
    });
  });
  useEffect(() => {
    root.current?.querySelector<HTMLElement>('[data-current="true"]')?.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'instant'});
  }, [mode, horizontal]);
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
        || document.getElementById('panel') || document.getElementById('lightbox')
        || (event.target as HTMLElement).closest('.artist-entry')) return;
    if (!['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? records.length - 1
      : Math.max(0, Math.min(records.length - 1, index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1)));
    onPick(records[next].id);
    requestAnimationFrame(() => {
      const cover = root.current?.querySelector<HTMLElement>('[data-current="true"] .gallery-cover-button');
      cover?.focus({preventScroll: true}); cover?.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'instant'});
    });
  };
  const tile = (r: AlbumRecord) => <div key={r.id} className="gallery-item" data-current={r.id === records[index]?.id}>
    <button type="button" className="gallery-cover-button gallery-case-button" tabIndex={r.id === records[index]?.id ? 0 : -1}
            data-gallery-record-id={r.id} aria-label={`查看封面：${r.title} · ${r.artist}`} onClick={event => onFocus(r.id, event.currentTarget)} title={r.title}>
      <GalleryCase record={r}/>
    </button>
    {showTitles || mode === 'waterfall' ? <div className="gallery-tile-caption">
      <button type="button" className="gallery-title" onClick={event => onFocus(r.id, event.currentTarget)}>{r.title}</button>
      <ArtistButton artist={r.artist} onOpen={name => onArtist(name, r.id)}/>
      {labelTags(r).length ? <span className="gallery-tile-tags">{labelTags(r).join(' · ')}</span> : null}
    </div> : null}
  </div>;
  return <div ref={root} className={`gallery-stage gallery-stage--${mode} gallery-density--${density}${viewport ? ' has-roam-viewport' : ''}${horizontal ? ' is-axis-x' : ''}`}
              style={{'--wall-gap-k': GALLERY_SPACING_SCALE[spacing]} as CSSProperties}
              tabIndex={0} role="region" aria-label="收藏展示，方向键选择封面" onKeyDown={key}
              onDragStart={event => event.preventDefault()}>
    {mode === 'tiles' ? <div className="gallery-wall">{records.map(tile)}</div>
      : <div className="gallery-waterfall">{columns.map((items, i) => <div key={i} className="gallery-waterfall-column">{items.map(tile)}</div>)}</div>}
  </div>;
}
