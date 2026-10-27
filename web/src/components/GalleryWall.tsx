import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {CSSProperties, KeyboardEvent} from 'react';
import {galleryHash, galleryIndex, GALLERY_ROAMING_DEFAULTS, GALLERY_SPACING_SCALE} from '../core/gallery';
import {labelTags} from '../types';
import type {AlbumRecord} from '../types';
import type {GalleryStageProps} from './GalleryStage';
import {GalleryCase} from './GalleryCase';
import {ArtistButton} from './ArtistButton';
import {measureGalleryGridLoop, paintGalleryScroll, useGalleryRoaming, roamGalleryScroller} from './useGalleryRoaming';
import type {GalleryScrollPosition} from './useGalleryRoaming';
import {advanceGalleryLoop} from '../core/gallery-motion';

// 瀑布流的错落：按副本稳定取一档宽度与左右位置（full 占满列宽，其余略窄并偏左 / 偏右 / 居中）
const WATERFALL_SIZES = ['full', 'full', 'left', 'left', 'right', 'right', 'center'];

/** 封面墙始终是铺满剩余屏幕的滚动窗口，巡游时无缝循环（重复渲染若干份，周期为整行）；瀑布流垂直巡游时各列单独滚动。
 * 水平方向下舞台自己是横向滚动容器，巡游推它的 scrollLeft。 */
export function GalleryWall({records, mode, currentId, density, spacing = 'normal', showTitles, axis = 'vertical', roaming = false, roamingSpeed = GALLERY_ROAMING_DEFAULTS[mode],
                             onPick, onFocus, onArtist}: GalleryStageProps) {
  const root = useRef<HTMLDivElement>(null);
  const scrollStates = useRef(new WeakMap<HTMLElement, GalleryScrollPosition>());
  // 巡游每帧要用的行距：只在尺寸变化后量一次，不在动画帧里读布局
  const pitches = useRef(new WeakMap<HTMLElement, number>());
  const [columnCount, setColumnCount] = useState(2);
  const [roamViewport, setRoamViewport] = useState(false);
  const horizontal = axis === 'horizontal';
  const loopable = !horizontal;
  const viewport = horizontal || loopable || roamViewport;
  // 循环：每个滚动容器（封面墙是舞台本身，瀑布流是每一列）铺 copies 份；periods[i] = 第 i 个容器一个周期的像素高度，
  // singles[i] = 只有一份时它能滚到的最大距离
  const [loop, setLoop] = useState<{copies: number; periods: number[]; singles: number[]} | null>(null);
  const loopRef = useRef(loop); loopRef.current = loop;
  const scrollers = () => {
    const area = root.current;
    if (!area) return [];
    return mode === 'waterfall' && !horizontal ? [...area.querySelectorAll<HTMLElement>('.gallery-waterfall-column')] : [area];
  };
  const index = galleryIndex(records, currentId);
  const columns = useMemo(() => {
    const result: AlbumRecord[][] = Array.from({length: columnCount}, () => []);
    records.forEach((r, i) => result[i % columnCount].push(r)); return result;
  }, [records, columnCount]);
  useEffect(() => {
    const el = root.current; if (!el) return;
    const narrow = () => el.clientWidth < 420;
    const resize = () => {
      pitches.current = new WeakMap();
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
  // 量出周期，决定要铺几份；内容不够铺满一屏时不循环（巡游也不动）
  useLayoutEffect(() => {
    const el = root.current;
    if (!loopable || !roaming || !el) return;
    const measureWall = () => {
      const grid = measureGalleryGridLoop(el, el.querySelectorAll<HTMLElement>('.gallery-wall>.gallery-item'), records.length);
      return grid && {copies: grid.copies, periods: [grid.period], singles: [grid.single]};
    };
    const measureColumns = () => {
      const periods: number[] = [], singles: number[] = [];
      let copies = 2;
      for (const [i, column] of scrollers().entries()) {
        const items = column.querySelectorAll<HTMLElement>(':scope>.gallery-item');
        const count = columns[i]?.length ?? 0;
        const first = items[0], last = items[count - 1];
        if (!first || !last) return null;
        const style = getComputedStyle(column);
        const span = last.offsetTop + last.offsetHeight - first.offsetTop;
        const period = span + (parseFloat(style.rowGap) || 0);
        periods.push(period);
        singles.push(Math.max(0, span + (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) - column.clientHeight));
        copies = Math.max(copies, 1 + Math.ceil(column.clientHeight / period));
      }
      return singles.some(single => single > 1) ? {copies, periods, singles} : null;
    };
    const measure = () => {
      const next = mode === 'tiles' ? measureWall() : measureColumns();
      setLoop(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(el);
    return () => observer.disconnect();
  }, [loopable, roaming, mode, records, columns, density, spacing, showTitles, loop?.copies]);
  // 关掉巡游：每个容器都回到单份所能滚到的范围内之后才撤掉副本，画面不跳
  useEffect(() => {
    const el = root.current;
    if (roaming || !loop || !el) return;
    const settle = () => {if (scrollers().every((s, i) => s.scrollTop <= (loop.singles[i] ?? 0))) setLoop(null);};
    settle(); el.addEventListener('scroll', settle, {passive: true, capture: true});
    return () => el.removeEventListener('scroll', settle, {capture: true});
  }, [roaming, loop]);
  const wrapLoop = (element: HTMLElement, i: number) => {
    const period = loopRef.current?.periods[i];
    if (!period || element.scrollTop < period) return;
    element.scrollTop -= period;
    const state = scrollStates.current.get(element);
    if (state) {state.position -= period; state.painted = element.scrollTop;}
  };
  useGalleryRoaming(root, roaming && viewport, seconds => {
    if (loopable && !loopRef.current) return;
    scrollers().forEach((element, i) => {
      let state = scrollStates.current.get(element);
      if (!state) {state = {position: element.scrollTop, painted: element.scrollTop, direction: 1}; scrollStates.current.set(element, state);}
      let pitch = pitches.current.get(element);
      if (pitch === undefined) {
        const cover = element.querySelector<HTMLElement>('.gallery-cover-button');
        pitch = ((horizontal ? cover?.offsetWidth : cover?.offsetHeight) || 160) + 24;
        pitches.current.set(element, pitch);
      }
      const stagger = mode === 'waterfall' && !horizontal ? [1, 1.18, .92, 1.08, .96, 1.12][i % 6] : 1;
      const period = loopRef.current?.periods[i];
      if (period) {
        if (Math.abs(element.scrollTop - state.painted) > 1) state.position = element.scrollTop;
        state.position = advanceGalleryLoop(state.position, seconds, pitch * stagger / roamingSpeed, period);
        state.painted = paintGalleryScroll(element, state.position);
        return;
      }
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
  // copy > 0 是循环用的副本：读屏跳过、不进 Tab 顺序，但仍可点开
  const tile = (r: AlbumRecord, copy = 0) => <div key={copy ? `${r.id}~${copy}` : r.id}
    className={`gallery-item${mode === 'waterfall' ? ` gallery-waterfall-size--${WATERFALL_SIZES[galleryHash(r.id) % WATERFALL_SIZES.length]}` : ''}`}
    data-current={!copy && r.id === records[index]?.id} aria-hidden={copy ? true : undefined}
    ref={copy ? node => node?.querySelectorAll('button').forEach(button => {button.tabIndex = -1;}) : undefined}>
    <button type="button" className="gallery-cover-button gallery-case-button" tabIndex={!copy && r.id === records[index]?.id ? 0 : -1}
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
              onDragStart={event => event.preventDefault()} onScroll={loop && mode === 'tiles' ? event => wrapLoop(event.currentTarget, 0) : undefined}>
    {mode === 'tiles' ? <div className="gallery-wall">{records.map(r => tile(r))}
      {loop ? Array.from({length: loop.copies - 1}, (_, c) => records.map(r => tile(r, c + 1))) : null}</div>
      : <div className="gallery-waterfall">{columns.map((items, i) => <div key={i} className="gallery-waterfall-column"
          onScroll={loop ? event => wrapLoop(event.currentTarget, i) : undefined}>{items.map(r => tile(r))}
        {loop ? Array.from({length: loop.copies - 1}, (_, c) => items.map(r => tile(r, c + 1))) : null}</div>)}</div>}
  </div>;
}
