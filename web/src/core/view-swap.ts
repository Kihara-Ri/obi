// 收藏展示 ↔ 沉浸展示的过渡：用 View Transitions 让屏幕内每一张封面都从旧位置平滑移动 / 缩放到新位置，
// 其余画面交叉淡化。封面按「图片地址 + 第几次出现」在两个状态里对应；某一边没有的那张就只淡入 / 淡出。
// 不支持（旧浏览器）或开启减少动态时直接切换。
import {flushSync} from 'react-dom';

type VT = {finished: Promise<void>};
type Doc = {startViewTransition?: (cb: () => void) => VT};

/** 屏幕内的封面（含上下各一屏的余量）→ 唯一的过渡名；同一地址的多张按出现顺序编号 */
function tag(): HTMLElement[] {
  const seen = new Map<string, number>(), out: HTMLElement[] = [];
  const edge = innerHeight;
  document.querySelectorAll<HTMLElement>('.gallery-page .gallery-artwork').forEach(el => {
    const src = el.querySelector('img')?.getAttribute('src');
    const r = el.getBoundingClientRect();
    if (!src || r.width <= 0 || r.bottom < -edge * .25 || r.top > edge * 1.25 || r.right < 0 || r.left > innerWidth) return;
    const n = seen.get(src) ?? 0;
    seen.set(src, n + 1);
    el.style.viewTransitionName = 'gc-' + (src + '#' + n).replace(/[^a-zA-Z0-9]/g, '').slice(-40) + '-' + (hash(src) + n);
    el.style.setProperty('view-transition-class', 'gallery-hero');
    out.push(el);
  });
  return out;
}
const hash = (s: string) => Array.from(s).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const untag = (list: HTMLElement[]) => list.forEach(el => { el.style.removeProperty('view-transition-name'); el.style.removeProperty('view-transition-class'); });

export function viewSwap(apply: () => void) {
  const doc = document as unknown as Doc;
  let reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* 无 matchMedia */ }
  if (!doc.startViewTransition || reduce) { apply(); return; }
  const before = tag();
  if (!before.length) { apply(); return; }
  let after: HTMLElement[] = [];
  const t = doc.startViewTransition.call(document, () => {
    untag(before);
    flushSync(apply);
    after = tag();
  });
  const clean = () => { untag(before); untag(after); };
  t.finished.then(clean, clean);
}
