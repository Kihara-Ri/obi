// 原生 <details> 开合是瞬间的。这里给全站的折叠块统一加过渡，时长与缓动读 --dur-slow / --ease-out token；减少动效时直接开合。
// 两种用法：
//   accordion(list)：手风琴（「开始使用」曲目表、「接口」页的客户端配置）。<details> 里放 .body > .inner，
//     留白写在 .inner 上，.body 只做高度动画的外壳（否则收到 0 时内边距还撑着，会留一截空白）。
//     脚本接管后去掉 name，由这里负责互斥，让被挤掉的那一项也平滑收回；没有 JS 时仍靠 name 互斥。
//     收回期间 <details> 带 data-closing，样式可据此让箭头等先回到收起态。
//   drop(details, panel)：浮在页面上的下拉面板（「接口」页手机目录）。不占版面，用裁切从上往下展开、往上收回。
const css = getComputedStyle(document.documentElement);
const ms = (parseFloat(css.getPropertyValue('--dur-slow')) || 0.28) * 1000;
const easing = css.getPropertyValue('--ease-out').trim() || 'ease-out';
const still = matchMedia('(prefers-reduced-motion: reduce)');
const running = new WeakMap<HTMLDetailsElement, Animation>();

const closing = (d: HTMLDetailsElement) => d.dataset.closing !== undefined;
/** 现在算不算「开着」：收回途中按「已收起」算，再点一下会重新展开 */
export const isOpen = (d: HTMLDetailsElement) => d.open && !closing(d);

function run(d: HTMLDetailsElement, open: boolean, el: HTMLElement | null, frames: (open: boolean) => Keyframe[]): Animation | null {
  running.get(d)?.cancel();
  if (!el || still.matches) { d.open = open; delete d.dataset.closing; return null; }
  if (open) { d.open = true; delete d.dataset.closing; } else { d.dataset.closing = ''; }
  const a = el.animate(frames(open), { duration: ms, easing });
  running.set(d, a);
  a.onfinish = () => {
    if (!open) { d.open = false; delete d.dataset.closing; }
    running.delete(d);
  };
  return a;
}

/** 高度过渡：从当前高度到目标高度，配合透明度 */
export function slide(d: HTMLDetailsElement, open: boolean) {
  const body = d.querySelector<HTMLElement>(':scope > .body');
  const from = d.open && body ? body.getBoundingClientRect().height : 0;
  const a = run(d, open, body, (o) => {
    const to = o && body ? body.scrollHeight : 0;
    return [{ height: `${from}px`, opacity: o ? 0 : 1 }, { height: `${to}px`, opacity: o ? 1 : 0 }];
  });
  if (a && body) {
    body.style.overflow = 'hidden';
    // 被新动画打断时不复位（新动画同样需要裁切）；正常结束才放开
    a.addEventListener('finish', () => { if (!running.has(d)) body.style.overflow = ''; });
  }
}

export function accordion(list: Iterable<HTMLDetailsElement>) {
  const all = [...list];
  for (const d of all) {
    d.removeAttribute('name');
    d.querySelector(':scope > summary')?.addEventListener('click', (e) => {
      e.preventDefault();
      const opening = !isOpen(d);
      if (opening) for (const o of all) if (o !== d && isOpen(o)) slide(o, false);
      slide(d, opening);
    });
  }
}

/** 下拉面板：裁切从上往下展开，收回时反过来；不改版面，不会推动页面 */
export function drop(d: HTMLDetailsElement, panel: HTMLElement | null, open: boolean) {
  run(d, open, panel, (o) => {
    const shut = { clipPath: 'inset(0 0 100% 0)', opacity: 0, transform: 'translateY(-.5rem)' };
    const full = { clipPath: 'inset(0 0 0 0)', opacity: 1, transform: 'none' };
    return o ? [shut, full] : [full, shut];
  });
}
