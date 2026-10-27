// 胶片下方的导航：一排小封面（印样条）+ 与其他布局同款的「‹ 序号 ›」胶囊。
// 当前那张高亮并保持在条中间，点哪张跳到哪张；条本身也能左右划着找。
import {useLayoutEffect, useRef} from 'react';
import type {AlbumRecord} from '../types';
import {StageControls} from './GalleryStageControls';

export function galleryFilmProgressLabel(position: number, count: number): string {
  if (count <= 1) return '全部收藏已显示，无需移动';
  return `第 ${Math.round(Math.max(0, Math.min(count - 1, position))) + 1} 张，共 ${count} 张`;
}

interface Props {
  records: AlbumRecord[];
  current: number;
  start: boolean;
  end: boolean;
  onStep(by: number): void;
  onJump(index: number): void;
}

export function GalleryFilmNavigator({records, current, start, end, onStep, onJump}: Props) {
  const strip = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  // 当前那张滚到条中间；首次挂载直接到位，之后平滑跟随
  useLayoutEffect(() => {
    const area = strip.current, thumb = area?.children[current] as HTMLElement | undefined;
    if (!area || !thumb) return;
    const left = thumb.offsetLeft - (area.clientWidth - thumb.offsetWidth) / 2;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    area.scrollTo({left, behavior: first.current || reduce ? 'instant' : 'smooth'});
    first.current = false;
  }, [current, records]);

  return <div className="gallery-film-dock">
    <div ref={strip} className="gallery-film-thumbs" role="group" aria-label="跳到某一张">
      {records.map((record, index) => <button key={record.id} type="button"
        className={`gallery-film-thumb${index === current ? ' is-current' : ''}`} aria-current={index === current ? 'true' : undefined}
        tabIndex={index === current ? 0 : -1} aria-label={`跳到第 ${index + 1} 张：${record.title} · ${record.artist}`} title={record.title}
        onClick={() => onJump(index)}>
        {record.cover ? <img src={record.cover} alt="" loading="lazy" decoding="async" draggable={false}/> : null}
      </button>)}
    </div>
    <StageControls index={current} count={records.length} start={records.length <= 1 || start} end={records.length <= 1 || end} step={onStep}/>
  </div>;
}
