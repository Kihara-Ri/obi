// 胶片布局：横向原生滚动的底片条，巡游时三份副本无缝循环；下方是印样条 + 序号胶囊（GalleryFilmNavigator）。
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {GalleryStageProps} from './GalleryStage';
import {galleryIndex, GALLERY_ROAMING_DEFAULTS} from '../core/gallery';
import {GalleryCase} from './GalleryCase';
import {GalleryFilmNavigator, galleryFilmProgressLabel} from './GalleryFilmNavigator';
import {stageKey} from './GalleryStageControls';
import {paintGalleryScroll, useGalleryRoaming} from './useGalleryRoaming';
import {useGalleryDragScroll} from './useGalleryDragScroll';
import {wrapGalleryPosition} from '../core/gallery-motion';

/** 手机使用原生横向滚动；桌面拖动只写 scrollLeft，不引入吸附。
 * 巡游时无缝循环：轨道铺三份（前副本 / 原件 / 后副本），位置始终留在中间那份，两侧总有邻张，接缝看不出来。 */
export function GalleryFilm(props: GalleryStageProps) {
  const {records, currentId, density, onFocus} = props;
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const scopeKey = useMemo(() => JSON.stringify(records.map(r => r.id)), [records]);
  const selected = galleryIndex(records, currentId);
  const [settledPosition, setSettledPosition] = useState(selected);
  const [nearestFrame, setNearestFrame] = useState(selected);
  const nearestRef = useRef(selected);
  const emphasised = useRef<HTMLElement[]>([]);
  const [limits, setLimits] = useState((selected === 0 ? 1 : 0) | (selected === records.length - 1 ? 2 : 0));
  const limitsRef = useRef(limits);
  const metric = useRef(1);
  const lastEcho = useRef(currentId);
  const restoredScope = useRef<string | null>(null);
  const timer = useRef(0);
  const frame = useRef(0);
  const roamPosition = useRef({position: 0, painted: 0});
  const {drag, handlers: dragHandlers} = useGalleryDragScroll({
    onStart: () => window.clearTimeout(timer.current), onMove: () => readPosition(), onRelease: () => {readPosition(); commit();},
  });
  const looping = !!props.roaming && records.length > 1;
  const loopingRef = useRef(looping); loopingRef.current = looping;
  // 原件在轨道里的起始序号（循环时前面有一份副本）
  const offset = () => loopingRef.current ? latest.current.records.length : 0;
  const rawRef = useRef(selected);
  useGalleryRoaming(stageRef, !!props.roaming, seconds => {
    const rail = railRef.current;
    if (!rail || drag.current || !loopingRef.current) return;
    const state = roamPosition.current;
    if (Math.abs(rail.scrollLeft - state.painted) > 1) state.position = rail.scrollLeft;
    state.position += seconds * metric.current / (props.roamingSpeed ?? GALLERY_ROAMING_DEFAULTS.film);
    state.painted = paintGalleryScroll(rail, state.position, true);
  });

  const readPosition = () => {
    const rail = railRef.current;
    if (!rail) return 0;
    const count = latest.current.records.length;
    const raw = rail.scrollLeft / metric.current;
    rawRef.current = raw;
    const position = loopingRef.current ? wrapGalleryPosition(raw - count, count) : Math.max(0, Math.min(count - 1, raw));
    // 离中心越近越大越亮：只改中心附近几格的 --d（0=居中，1=远），其余格恢复默认
    const items = rail.children;
    const from = Math.max(0, Math.floor(raw) - 2), to = Math.min(items.length - 1, Math.ceil(raw) + 2);
    const live: HTMLElement[] = [];
    for (let i = from; i <= to; i++) {
      const item = items[i] as HTMLElement;
      item.style.setProperty('--d', String(Math.min(1, Math.abs(i - raw))));
      live.push(item);
    }
    emphasised.current.forEach(item => {if (!live.includes(item)) item.style.removeProperty('--d');});
    emphasised.current = live;
    const near = Math.round(position) % count;
    if (near !== nearestRef.current) {nearestRef.current = near; setNearestFrame(near);}
    const edges = loopingRef.current ? 0 : (position < .001 ? 1 : 0) | (position >= count - 1 - .001 ? 2 : 0);
    if (edges !== limitsRef.current) {limitsRef.current = edges; setLimits(edges);}
    return position;
  };
  const commit = () => {
    if (drag.current?.moved) return;
    const rail = railRef.current;
    const count = latest.current.records.length, raw = (rail?.scrollLeft || 0) / metric.current;
    const position = loopingRef.current ? wrapGalleryPosition(raw - count, count) : Math.max(0, Math.min(count - 1, raw));
    const next = Math.round(position) % count;
    const record = latest.current.records[next];
    if (!record) return;
    setSettledPosition(position);
    lastEcho.current = record.id;
    if (record.id !== latest.current.currentId) latest.current.onPick(record.id);
  };
  const onScroll = () => {
    // 循环：离开中间那份就平移一个周期回来（前后两份内容相同，画面不变）
    const rail = railRef.current, count = latest.current.records.length;
    if (rail && loopingRef.current) {
      const raw = rail.scrollLeft / metric.current;
      const shift = raw >= count * 2 ? -count : raw < count - 1 ? count : 0;
      if (shift) {
        rail.scrollLeft += shift * metric.current;
        roamPosition.current.position += shift * metric.current; roamPosition.current.painted = rail.scrollLeft;
        if (drag.current) drag.current.scroll += shift * metric.current;
      }
    }
    if (rail) rawRef.current = rail.scrollLeft / metric.current;
    if (!frame.current) frame.current = requestAnimationFrame(() => {frame.current = 0; readPosition();});
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(commit, 140);
  };

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const measure = () => {
      const items = rail.querySelectorAll<HTMLElement>('.gallery-film-item');
      const previousPosition = rail.scrollLeft / metric.current;
      const first = items[0], second = items[1];
      metric.current = Math.max(1, second && first ? second.offsetLeft - first.offsetLeft
        : (first ? parseFloat(getComputedStyle(first).width) : 1) + (parseFloat(getComputedStyle(rail).columnGap) || 0));
      rail.scrollLeft = Math.max(0, Math.min(rail.children.length - 1, previousPosition)) * metric.current;
      readPosition();
    };
    measure();
    if (restoredScope.current !== scopeKey) {
      rail.scrollLeft = (selected + offset()) * metric.current;
      setSettledPosition(selected);
      lastEcho.current = currentId;
      restoredScope.current = scopeKey;
    }
    readPosition();
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [scopeKey, density]);

  useEffect(() => {
    if (lastEcho.current === currentId) return;
    lastEcho.current = currentId;
    const rail = railRef.current;
    if (rail) rail.scrollLeft = (selected + offset()) * metric.current;
    setSettledPosition(selected);
    readPosition();
  }, [currentId, selected]);
  // 进出循环：前面多了 / 少了一份，平移同样的距离，画面停在原地（退出时落回原件范围）
  const wasLooping = useRef(looping);
  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail || wasLooping.current === looping) return;
    wasLooping.current = looping;
    const count = records.length;
    const position = looping ? rawRef.current + count : wrapGalleryPosition(rawRef.current - count, count);
    rail.scrollLeft = Math.max(0, Math.min(rail.children.length - 1, position)) * metric.current;
    readPosition();
  }, [looping]);
  useEffect(() => () => {
    window.clearTimeout(timer.current);
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  const step = (by: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const raw = Math.round(rail.scrollLeft / metric.current) + by;
    const target = looping ? raw : Math.max(0, Math.min(records.length - 1, raw));
    rail.scrollTo({left: target * metric.current,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  };
  // 点缩略图：循环时挑离当前最近的那一份，不绕远路
  const jump = (index: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const count = records.length;
    const target = looping ? [0, 1, 2].map(copy => index + copy * count)
      .reduce((best, raw) => Math.abs(raw - rawRef.current) < Math.abs(best - rawRef.current) ? raw : best) : index;
    rail.scrollTo({left: target * metric.current,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  };

  return <div ref={stageRef} className={`gallery-stage gallery-stage--film gallery-density--${density}`} tabIndex={0}
    role="region" aria-label="胶片连续浏览，左右方向键浏览" onKeyDown={event => stageKey(event, step)}>
    <div className="gallery-film-shell">
      <div className="gallery-film-rail" ref={railRef} onScroll={onScroll} onDragStart={event => event.preventDefault()}
        {...dragHandlers}>
        {(looping ? [-1, 0, 1] : [0]).flatMap(copy => records.map((record, index) => <div key={copy ? `${record.id}~${copy}` : record.id}
          className="gallery-film-item" data-motion-index={index} aria-hidden={copy ? true : undefined}>
          <button type="button" className="gallery-cover-button gallery-continuous-cover gallery-case-button"
            data-gallery-record-id={record.id} tabIndex={copy ? -1 : undefined}
            aria-label={`查看封面：${record.title} · ${record.artist}`} title={record.title}
            onClick={event => {lastEcho.current = record.id; onFocus(record.id, event.currentTarget);}}>
            <GalleryCase record={record}/>
          </button>
        </div>))}
      </div>
      {records[nearestFrame] ? <p className="gallery-film-caption" aria-hidden="true">
        <b>{records[nearestFrame].title}</b><span>{records[nearestFrame].artist}</span>
        <i>{String(nearestFrame + 1).padStart(2, '0')}</i>
      </p> : null}
      <GalleryFilmNavigator records={records} current={nearestFrame}
        start={!!(limits & 1)} end={!!(limits & 2)} onStep={step} onJump={jump}/>
    </div>
    <span className="gallery-visually-hidden" aria-live="polite" aria-atomic="true">{galleryFilmProgressLabel(settledPosition, records.length)}</span>
  </div>;
}
