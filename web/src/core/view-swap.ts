// 收藏展示 ↔ 沉浸展示的过渡：用 View Transitions 让屏幕内每一张封面都从旧位置平滑移动 / 缩放到新位置，
// 其余画面交叉淡化。封面按专辑 id 在两个状态里对应；某一边没有的那张就只淡入 / 淡出。
// 不支持（旧浏览器）或开启减少动态时直接切换。
import {flushSync} from 'react-dom';

type VT = {finished: Promise<void>};
type Doc = {startViewTransition?: (cb: () => void) => VT};

/** 屏幕内的封面（含上下各一屏的余量）→ 以专辑 id 命名的过渡名；同一专辑出现多次（不同展示格）按出现顺序编号 */
function tag(): HTMLElement[] {
  const seen = new Map<string, number>(), out: HTMLElement[] = [];
  const edge = innerHeight;
  document.querySelectorAll<HTMLElement>('.gallery-page .gallery-artwork').forEach(el => {
    const src = el.dataset.artId;
    const r = el.getBoundingClientRect();
    if (!src || r.width <= 0 || r.bottom < -edge * .25 || r.top > edge * 1.25 || r.right < 0 || r.left > innerWidth) return;
    const n = seen.get(src) ?? 0;
    seen.set(src, n + 1);
    el.style.viewTransitionName = 'gc-' + src.replace(/[^a-zA-Z0-9]/g, '') + '-' + hash(src) + '-' + n;
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
  // 记下最靠近屏幕中心的那张：切换后先把它滚回屏幕中央，再给两边配对——
  // 否则新布局沿用旧的滚动位置（沉浸里滚得很深），原来的那批封面不在屏幕内，就缩不回原来的位置
  const cx = innerWidth / 2, cy = innerHeight / 2;
  const dist = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy); };
  const heroSrc = before.slice().sort((a, b) => dist(a) - dist(b))[0]?.dataset.artId;
  let after: HTMLElement[] = [];
  const t = doc.startViewTransition.call(document, () => {
    untag(before);
    flushSync(apply);
    const hero = Array.from(document.querySelectorAll<HTMLElement>('.gallery-page .gallery-artwork'))
      .find(el => el.dataset.artId === heroSrc);
    hero?.scrollIntoView({block: 'center', inline: 'center', behavior: 'instant' as ScrollBehavior});
    after = tag();
  });
  const clean = () => { untag(before); untag(after); };
  t.finished.then(clean, clean);
}
