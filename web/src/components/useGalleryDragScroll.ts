// 桌面鼠标拖动横向滚动容器（手机走原生滚动，不经过这里）：只写 scrollLeft，不引入吸附；
// 竖向手势让给页面；拖过之后吞掉松手那一下的 click，免得拖完误开灯箱。
import {useRef} from 'react';
import type {MouseEvent, PointerEvent} from 'react';

export interface GalleryDragState {id: number; x: number; y: number; scroll: number; moved: boolean}

export function useGalleryDragScroll({onStart, onMove, onRelease}: {
  onStart(): void;      // 按下：停掉待提交的计时等
  onMove(): void;       // 每次挪动后读一次位置
  onRelease(): void;    // 松手 / 取消：读位置并提交
}) {
  const drag = useRef<GalleryDragState | null>(null);
  const trailingClick = useRef(false);
  const release = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    if (active.moved && event.type === 'pointerup') event.currentTarget.scrollLeft = active.scroll - (event.clientX - active.x);
    drag.current = null;
    event.currentTarget.removeAttribute('data-dragging');
    if (active.moved) trailingClick.current = true;
    try {if (event.currentTarget.hasPointerCapture(active.id)) event.currentTarget.releasePointerCapture(active.id);} catch { /* 已由浏览器取消。 */ }
    onRelease();
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    trailingClick.current = false;
    if (!event.isPrimary) {drag.current = null; event.currentTarget.removeAttribute('data-dragging'); return;}
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    onStart();
    event.currentTarget.scrollTo({left: event.currentTarget.scrollLeft, behavior: 'instant'});
    drag.current = {id: event.pointerId, x: event.clientX, y: event.clientY, scroll: event.currentTarget.scrollLeft, moved: false};
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    const dx = event.clientX - active.x, dy = event.clientY - active.y;
    if (!active.moved) {
      if (Math.hypot(dx, dy) < 5) return;
      if (Math.abs(dy) > Math.abs(dx)) {trailingClick.current = true; drag.current = null; return;}
      active.moved = true;
      event.currentTarget.setAttribute('data-dragging', 'true');
      try {event.currentTarget.setPointerCapture(event.pointerId);} catch { /* 合成或已取消的指针。 */ }
    }
    event.preventDefault();
    event.currentTarget.scrollLeft = active.scroll - dx;
    onMove();
  };
  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (event.detail !== 0 && (drag.current?.moved || trailingClick.current)) {
      trailingClick.current = false;
      event.preventDefault(); event.stopPropagation();
    }
  };
  return {drag, handlers: {onPointerDown, onPointerMove, onPointerUp: release, onPointerCancel: release,
    onLostPointerCapture: release, onClickCapture}};
}
