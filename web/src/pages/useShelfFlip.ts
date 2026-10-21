// 库存「列表 ↔ 卡片」共享元素转场（FLIP）：切换前记下每张封面的位置，切换后让同一张专辑的封面
// 从旧位置 / 旧大小飞到新位置，其余内容淡入。只处理视口附近的封面（上限 MAX），其余直接换。
// 调用方在改视图之前调用 snapshot()；减少动态效果下什么都不做。
import {useCallback, useLayoutEffect, useRef} from 'react';

const MAX = 48;
const MOVE_MS = 420;
const FADE_MS = 240;
const EASE = 'cubic-bezier(.2,.7,.2,1)';

function coverOf(card: Element): HTMLElement | null {
  return card.querySelector<HTMLElement>('.cover-wrap, .album-cover') ?? card.querySelector<HTMLElement>('.cover');
}

function nearViewport(r: DOMRect): boolean {
  return r.bottom > -120 && r.top < window.innerHeight + 120 && r.width > 0;
}

export function useShelfFlip(root: React.RefObject<HTMLElement | null>, view: string) {
  const before = useRef<Map<string, DOMRect> | null>(null);
  const prevView = useRef(view);

  const snapshot = useCallback(() => {
    const map = new Map<string, DOMRect>();
    root.current?.querySelectorAll<HTMLElement>('.card[data-id]').forEach(card => {
      const cover = coverOf(card);
      const rect = cover?.getBoundingClientRect();
      if (rect && nearViewport(rect) && map.size < MAX) map.set(card.dataset.id!, rect);
    });
    before.current = map;
  }, [root]);

  useLayoutEffect(() => {
    const from = before.current;
    before.current = null;
    if (prevView.current === view) return;
    prevView.current = view;
    const page = root.current;
    if (!from || !page || typeof page.animate !== 'function') return;
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch { return; }
    // 飞行期间卡片不能裁切封面，也不能被相邻卡片盖住
    page.classList.add('is-flipping');
    const anims: Animation[] = [];
    page.querySelectorAll<HTMLElement>('.card[data-id]').forEach(card => {
      const cover = coverOf(card);
      const old = from.get(card.dataset.id!);
      const now = cover?.getBoundingClientRect();
      anims.push(card.animate([{opacity: old ? .35 : 0}, {opacity: 1}], {duration: FADE_MS, easing: 'ease-out'}));
      if (!cover || !old || !now || !now.width || !now.height) return;
      const dx = old.left - now.left;
      const dy = old.top - now.top;
      const sx = old.width / now.width;
      const sy = old.height / now.height;
      cover.style.zIndex = '3';
      const a = cover.animate([
        {transformOrigin: '0 0', transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`},
        {transformOrigin: '0 0', transform: 'none'},
      ], {duration: MOVE_MS, easing: EASE});
      anims.push(a);
      a.finished.catch(() => undefined).then(() => { cover.style.zIndex = ''; });
    });
    const end = () => page.classList.remove('is-flipping');
    Promise.allSettled(anims.map(a => a.finished)).then(end);
    return () => { anims.forEach(a => a.cancel()); end(); };
  }, [view, root]);

  return snapshot;
}
