// 连续布局共用的舞台键盘处理与箭头 / 位置指示（箭头也供中心布局使用）。
import type {KeyboardEvent} from 'react';

export function stageKey(event: KeyboardEvent<HTMLDivElement>, step: (by: number) => void) {
  if (event.defaultPrevented || event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      document.getElementById('panel') || document.getElementById('lightbox')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); step(event.key === 'ArrowRight' ? 1 : -1);
  }
}

export function StageArrow({next = false}: {next?: boolean}) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={next ? 'M5 12h14m-6-6 6 6-6 6' : 'M19 12H5m6-6-6 6 6 6'}/>
  </svg>;
}

export function StageControls({index, count, start, end, step, showPosition = true}: {
  index: number; count: number; start: boolean; end: boolean; step(by: number): void; showPosition?: boolean;
}) {
  return <div className="gallery-stage-controls" role="group" aria-label="连续浏览收藏">
    <button type="button" className="gallery-stage-arrow" disabled={start} aria-label="向前浏览" title="向前浏览"
      onClick={() => step(-1)}><StageArrow/></button>
    {showPosition ? <span className="gallery-stage-position" aria-hidden="true">{index + 1} / {count}</span> : null}
    <button type="button" className="gallery-stage-arrow" disabled={end} aria-label="向后浏览" title="向后浏览"
      onClick={() => step(1)}><StageArrow next/></button>
  </div>;
}

