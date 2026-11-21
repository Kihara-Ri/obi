// 库存卡片 / 列表行的重排转场（FLIP）：搜索、排序、筛选、新增、移除、售出后，
// 留下的卡片从旧位置平滑移到新位置，新出现的卡片淡入并轻微放大。
// 被移除的卡片（售出、调走、删除）：React 已把节点摘掉，这里用上一帧记下的元素复制一个替身放回原位，
// 只把带圆角的封面飞向去处在导航里的入口（售出 → 「售出中」，入口随后轻跳一下），卡片其余部分原地淡出
// （2026-11-20：原来整张卡片一起飞，太重）；入口看不到（删除、选择模式隐藏了底栏、只是被筛选掉）就原地
// 缩小淡出。后面的卡片稍等替身离开再上移补位（2026-11-19）。
// 2026-11-21：飞行部分拆到 cardFly.ts；售出中、交易记录、海外在途的整单 / 包裹卡片也用这里（selector 指定卡片），
// 销售单确认收货、撤销、退款，包裹签收、撤销运输都把封面飞向专辑的新去处。
// orderKey 变化才触发；scopeKey（页面 / 视图）变化说明是整页切换，由别处负责，这里只刷新记录。
import {useLayoutEffect, useRef} from 'react';
import {flyGhost, measureCovers, navTarget, type Pos} from './cardFly';
export {destOfStatus} from './cardFly';

const MAX = 60;
const MAX_GHOSTS = 12;
const MOVE_MS = 380;
const EASE = 'cubic-bezier(.2,.7,.2,1)';

export interface ListFlipOpts {
  /** 参与转场的卡片（带 data-id），默认库存卡片 */
  selector?: string;
  /** 卡片当前去处在导航里的 hash（见 cardFly.destOfStatus）；没有就原地淡出 */
  destOf?: (id: string) => string | null;
}

function measure(root: HTMLElement, selector: string, destOf?: (id: string) => string | null): Map<string, Pos> {
  const map = new Map<string, Pos>();
  const sx = window.scrollX, sy = window.scrollY;
  root.querySelectorAll<HTMLElement>(selector).forEach(card => {
    const r = card.getBoundingClientRect();
    if (r.width <= 0) return;
    const id = card.dataset.id!;
    map.set(id, {x: r.left + sx, y: r.top + sy, w: r.width, h: r.height, el: card, parent: card.parentElement,
      covers: measureCovers(card, r), dest: destOf?.(id) ?? null});
  });
  return map;
}

export function useListFlip(root: React.RefObject<HTMLElement | null>, orderKey: string, scopeKey: string,
                            {selector = '.card[data-id]', destOf}: ListFlipOpts = {}) {
  const last = useRef<{map: Map<string, Pos>; order: string; scope: string} | null>(null);

  useLayoutEffect(() => {
    const page = root.current;
    if (!page) return;
    const prev = last.current;
    const sx = window.scrollX, sy = window.scrollY;
    const animate = prev && prev.scope === scopeKey && prev.order !== orderKey && typeof page.animate === 'function'
      && !(() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } })();
    if (animate) {
      // 先放替身：抽屉还在收起时稍等它让开，替身才看得见
      const present = new Set(Array.from(page.querySelectorAll<HTMLElement>(selector), c => c.dataset.id!));
      const wait = document.querySelector('.drawer') ? 200 : 0;
      const here = scopeKey.split('|')[0];
      let ghosts = 0;
      prev.map.forEach((old, id) => {
        if (present.has(id) || ghosts >= MAX_GHOSTS) return;
        const top = old.y - sy;
        if (top + old.h < 0 || top > window.innerHeight) return;
        const dest = destOf?.(id);
        flyGhost(page, old, dest && dest !== here ? navTarget(dest) : null, wait + ghosts * 40);
        ghosts++;
      });
      const moveDelay = ghosts ? wait + 140 : 0;
      let count = 0;
      page.querySelectorAll<HTMLElement>(selector).forEach(card => {
        const r = card.getBoundingClientRect();
        if (r.width <= 0 || r.bottom < -80 || r.top > window.innerHeight + 80 || count >= MAX) return;
        const id = card.dataset.id!;
        const old = prev.map.get(id);
        count++;
        // 卡片还在、专辑却换了去处（包裹签收后挪到「最近签收」）：封面照样飞向新去处
        const dest = old && destOf?.(id);
        if (old && dest && dest !== old.dest && dest !== here && ghosts < MAX_GHOSTS && old.y - sy < window.innerHeight && old.y - sy + old.h > 0) {
          flyGhost(page, old, navTarget(dest), wait + ghosts * 40, false);
          ghosts++;
        }
        if (!old) {
          card.animate([{opacity: 0, transform: 'scale(.95)'}, {opacity: 1, transform: 'none'}],
            {duration: 260, easing: EASE, delay: Math.min(count, 12) * 12, fill: 'backwards'});
          return;
        }
        const dx = old.x - (r.left + sx);
        const dy = old.y - (r.top + sy);
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        card.animate([{transform: `translate(${dx}px,${dy}px)`}, {transform: 'none'}],
          {duration: MOVE_MS, easing: EASE, delay: moveDelay, fill: 'backwards'});
      });
    }
    last.current = {map: measure(page, selector, destOf), order: orderKey, scope: scopeKey};
  });
}
