// 桌面铺开：唱片随手散放在木纹桌面上，铺满剩余屏幕的滚动窗口，巡游时无缝循环。
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {GalleryStageProps} from './GalleryStage';
import {galleryHash, GALLERY_ROAMING_DEFAULTS} from '../core/gallery';
import {labelTags} from '../types';
import type {AlbumRecord} from '../types';
import {ArtistButton} from './ArtistButton';
import {GalleryCase} from './GalleryCase';
import {measureGalleryGridLoop, paintGalleryScroll, useGalleryRoaming} from './useGalleryRoaming';
import {advanceGalleryLoop} from '../core/gallery-motion';

/** 唱片随手散放在一张桌面上：舞台是铺满剩余屏幕的滚动窗口，巡游时与封面墙同一套无缝循环（重复渲染整行周期的副本）。 */
export function GalleryTable({records, currentId, density, showTitles, roaming = false, roamingSpeed = GALLERY_ROAMING_DEFAULTS.table, onFocus, onArtist}: GalleryStageProps) {
  const root = useRef<HTMLDivElement>(null);
  const roamPosition = useRef({position: 0, painted: 0, direction: 1});
  const [loop, setLoop] = useState<{copies: number; period: number; single: number} | null>(null);
  const loopRef = useRef(loop); loopRef.current = loop;
  const pitch = useRef(0);   // 巡游每帧用的行距，尺寸变化时重量
  useLayoutEffect(() => {
    const el = root.current;
    if (!roaming || !el) return;
    const measure = () => {
      pitch.current = 0;
      const next = measureGalleryGridLoop(el, el.querySelectorAll<HTMLElement>('.gallery-table-grid>.gallery-table-item'), records.length);
      setLoop(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(el);
    return () => observer.disconnect();
  }, [roaming, records, density, showTitles, loop?.copies]);
  // 关掉巡游：回到单份所能滚到的范围内之后才撤掉副本，画面不跳
  useEffect(() => {
    const el = root.current;
    if (roaming || !loop || !el) return;
    const settle = () => {if (el.scrollTop <= loop.single) setLoop(null);};
    settle(); el.addEventListener('scroll', settle, {passive: true});
    return () => el.removeEventListener('scroll', settle);
  }, [roaming, loop]);
  useGalleryRoaming(root, roaming, seconds => {
    const area = root.current, period = loopRef.current?.period;
    if (!area || !period) return;
    const state = roamPosition.current;
    if (!pitch.current) pitch.current = (area.querySelector<HTMLElement>('.gallery-cover-button')?.offsetHeight || 160) + 36;
    if (Math.abs(area.scrollTop - state.painted) > 1) state.position = area.scrollTop;
    state.position = advanceGalleryLoop(state.position, seconds, pitch.current / roamingSpeed, period);
    state.painted = paintGalleryScroll(area, state.position);
  });
  const wrap = (element: HTMLElement) => {
    const period = loopRef.current?.period;
    if (!period || element.scrollTop < period) return;
    element.scrollTop -= period;
    roamPosition.current.position -= period; roamPosition.current.painted = element.scrollTop;
  };
  const scopeKey = useMemo(() => JSON.stringify(records.map(r => r.id)), [records]);
  useEffect(() => {
    if (!currentId) return;
    const buttons = root.current?.querySelectorAll<HTMLElement>('[data-record-id]');
    [...(buttons || [])].find(button => button.dataset.recordId === currentId)
      ?.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'instant'});
  }, [scopeKey]);
  // copy > 0 是循环用的副本：读屏跳过、不进 Tab 顺序，但仍可点开
  const item = (record: AlbumRecord, copy = 0) => {
    const tags = labelTags(record);
    return <div key={copy ? `${record.id}~${copy}` : record.id} className={`gallery-table-item gallery-table-angle--${galleryHash(record.id) % 9}`}
      aria-hidden={copy ? true : undefined}
      ref={copy ? node => node?.querySelectorAll('button').forEach(button => {button.tabIndex = -1;}) : undefined}>
      <button type="button" className="gallery-cover-button gallery-continuous-cover gallery-case-button" data-record-id={copy ? undefined : record.id} data-gallery-record-id={record.id}
        aria-label={`查看封面：${record.title} · ${record.artist}`} title={record.title} onClick={event => onFocus(record.id, event.currentTarget)}>
        <GalleryCase record={record} spatial/>
      </button>
      {showTitles ? <div className="gallery-tile-caption">
        <button type="button" className="gallery-title" title={record.title} onClick={event => onFocus(record.id, event.currentTarget)}>{record.title}</button>
        <ArtistButton artist={record.artist} onOpen={artist => onArtist(artist, record.id)}/>
        {tags.length ? <span className="gallery-tile-tags">{tags.join(' · ')}</span> : null}
      </div> : null}
    </div>;
  };
  return <div ref={root} className={`gallery-stage gallery-stage--table gallery-density--${density} has-roam-viewport`}
    role="region" aria-label="桌面铺开，滚动查看全部收藏" onScroll={loop ? event => wrap(event.currentTarget) : undefined}>
    <div className="gallery-table-grid" onDragStart={event => event.preventDefault()}>
      {records.map(record => item(record))}
      {loop ? Array.from({length: loop.copies - 1}, (_, c) => records.map(record => item(record, c + 1))) : null}
    </div>
  </div>;
}
