// 页内跳转（#start 等）：浏览器自带的 smooth 滚动起步和收尾都很硬，长距离像被拽过去。
// 这里接管页内锚点：按距离定时长（0.6–1.1 秒），三次缓入缓出；用户滚轮、触摸或按键立即交还控制。
// 减少动态效果时不接管，直接跳。
const still = matchMedia('(prefers-reduced-motion: reduce)');
const ease = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
let run = 0;

function glide(to: number): void {
  const from = scrollY;
  const dist = to - from;
  const dur = Math.min(1100, Math.max(600, Math.abs(dist) * 0.45));
  const id = ++run;
  const start = performance.now();
  const html = document.documentElement;
  html.style.scrollBehavior = 'auto'; // 关掉全局 smooth，否则每帧的 scrollTo 又被它平滑一遍
  const frame = (now: number) => {
    if (id !== run) return;
    const k = Math.min(1, (now - start) / dur);
    scrollTo(0, from + dist * ease(k));
    if (k < 1) requestAnimationFrame(frame);
    else html.style.removeProperty('scroll-behavior');
  };
  requestAnimationFrame(frame);
}

const cancel = () => { run++; document.documentElement.style.removeProperty('scroll-behavior'); };
for (const type of ['wheel', 'touchstart', 'keydown']) addEventListener(type, cancel, { passive: true });

document.addEventListener('click', (e) => {
  if (still.matches || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
  const id = a?.getAttribute('href')!.slice(1);
  const target = id ? document.getElementById(id) : a ? document.documentElement : null;
  if (!a || !target) return;
  e.preventDefault();
  const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const max = document.documentElement.scrollHeight - innerHeight;
  glide(Math.min(max, Math.max(0, target.getBoundingClientRect().top + scrollY - pad)));
  history.pushState(null, '', `#${id ?? ''}`);
});
