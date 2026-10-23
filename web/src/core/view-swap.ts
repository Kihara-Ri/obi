// 收藏展示 ↔ 沉浸展示的过渡：用 View Transitions 让「最靠近屏幕中心的那张封面」从旧位置平滑放大 / 缩回新位置，
// 其余画面交叉淡化。封面按图片地址在两个状态里对应；不支持（旧浏览器）或减少动态时直接切换。
import {flushSync} from 'react-dom';

const NAME = 'gallery-hero';
type VT = {finished: Promise<void>};
type Doc = {startViewTransition?: (cb: () => void) => VT};

function covers(src?: string) {
  return Array.from(document.querySelectorAll<HTMLElement>('.gallery-page .gallery-artwork')).filter(el => {
    const img = el.querySelector('img');
    return img && (!src || img.getAttribute('src') === src) && el.getBoundingClientRect().width > 0;
  });
}
function nearestCenter(list: HTMLElement[]) {
  const cx = innerWidth / 2, cy = innerHeight / 2;
  let best: HTMLElement | null = null, bestD = Infinity;
  for (const el of list) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
    if (d < bestD) { best = el; bestD = d; }
  }
  return best;
}

export function viewSwap(apply: () => void) {
  const doc = document as unknown as Doc;
  let reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* 无 matchMedia */ }
  const hero = doc.startViewTransition && !reduce ? nearestCenter(covers()) : null;
  if (!doc.startViewTransition || reduce || !hero) { apply(); return; }
  const src = hero.querySelector('img')?.getAttribute('src') ?? undefined;
  hero.style.viewTransitionName = NAME;
  let target: HTMLElement | null = null;
  const t = doc.startViewTransition.call(document, () => {
    hero.style.viewTransitionName = '';
    flushSync(apply);
    target = nearestCenter(covers(src));
    if (target) target.style.viewTransitionName = NAME;
  });
  const clean = () => { hero.style.viewTransitionName = ''; (target as HTMLElement | null)?.style.removeProperty('view-transition-name'); };
  t.finished.then(clean, clean);
}
