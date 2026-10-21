// 库存卡片 / 列表行的重排转场（FLIP）：搜索、排序、筛选、新增、移除、售出后，
// 留下的卡片从旧位置平滑移到新位置，新出现的卡片淡入并轻微放大。
// 被移除的卡片已不在 DOM 里，无法淡出，由后面的卡片上移填补。
// orderKey 变化才触发；scopeKey（页面 / 视图）变化说明是整页切换，由别处负责，这里只刷新记录。
import {useLayoutEffect, useRef} from 'react';

const MAX = 60;
const MOVE_MS = 380;
const EASE = 'cubic-bezier(.2,.7,.2,1)';

interface Pos {x: number; y: number; w: number; h: number}

function measure(root: HTMLElement): Map<string, Pos> {
  const map = new Map<string, Pos>();
  const sx = window.scrollX, sy = window.scrollY;
  root.querySelectorAll<HTMLElement>('.card[data-id]').forEach(card => {
    const r = card.getBoundingClientRect();
    if (r.width > 0) map.set(card.dataset.id!, {x: r.left + sx, y: r.top + sy, w: r.width, h: r.height});
  });
  return map;
}

export function useListFlip(root: React.RefObject<HTMLElement | null>, orderKey: string, scopeKey: string) {
  const last = useRef<{map: Map<string, Pos>; order: string; scope: string} | null>(null);

  useLayoutEffect(() => {
    const page = root.current;
    if (!page) return;
    const prev = last.current;
    const sx = window.scrollX, sy = window.scrollY;
    const animate = prev && prev.scope === scopeKey && prev.order !== orderKey && typeof page.animate === 'function'
      && !(() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } })();
    if (animate) {
      let count = 0;
      page.querySelectorAll<HTMLElement>('.card[data-id]').forEach(card => {
        const r = card.getBoundingClientRect();
        if (r.width <= 0 || r.bottom < -80 || r.top > window.innerHeight + 80 || count >= MAX) return;
        const old = prev.map.get(card.dataset.id!);
        count++;
        if (!old) {
          card.animate([{opacity: 0, transform: 'scale(.95)'}, {opacity: 1, transform: 'none'}],
            {duration: 260, easing: EASE, delay: Math.min(count, 12) * 12, fill: 'backwards'});
          return;
        }
        const dx = old.x - (r.left + sx);
        const dy = old.y - (r.top + sy);
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        card.animate([{transform: `translate(${dx}px,${dy}px)`}, {transform: 'none'}],
          {duration: MOVE_MS, easing: EASE});
      });
    }
    last.current = {map: measure(page), order: orderKey, scope: scopeKey};
  });
}
