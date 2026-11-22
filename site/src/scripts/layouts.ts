// 九种布局预览（Layouts.astro）的动效与自动轮换。
// - 动效：只驱动当前选中、且在视口里的那张预览；每张预览有自己的时钟，切走再切回从原处接着动。
//   姿态来自 lib/gallery-poses.ts（与服务端首帧同一套），只改 SVG 的 transform / opacity 属性，CSP 不变。
// - 轮换：没人碰过时每 6 秒切到下一种；用户点过或按过键就不再自动切。
// - 减少动态效果时两者都不做，停在静态首帧。
import { COUNT, LAYERED, pose, transform } from '../lib/gallery-poses';
import type { Mode } from '../lib/gallery-poses';

const viewer = document.querySelector<HTMLElement>('[data-layouts]');
if (viewer && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const radios = [...viewer.querySelectorAll<HTMLInputElement>('input[name="layout"]')];
  const stages = [...viewer.querySelectorAll<SVGSVGElement>('svg[data-mode]')].map((svg) => {
    const box = svg.querySelector<SVGGElement>('[data-items]')!;
    const items: SVGGElement[] = [];
    for (const g of box.querySelectorAll<SVGGElement>('.it')) items[Number(g.dataset.i)] = g;
    return { mode: svg.dataset.mode as Mode, box, items, t: 0, order: '' };
  });

  const paint = (s: (typeof stages)[number]) => {
    const poses = Array.from({ length: COUNT[s.mode] }, (_, i) => pose(s.mode, i, s.t));
    poses.forEach((p, i) => {
      const g = s.items[i];
      g.setAttribute('transform', transform(p));
      g.setAttribute('opacity', String(Math.round((p.o ?? 1) * 100) / 100));
      g.querySelector('.dim')?.setAttribute('opacity', String(Math.round((p.dim ?? 0) * 100) / 100));
      g.querySelector('.hl')?.setAttribute('opacity', String(Math.round((p.hl ?? 0) * 100) / 100));
    });
    if (!LAYERED.includes(s.mode)) return;
    const order = poses.map((p, i) => [p.z ?? 0, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
    const key = order.join(',');
    if (key === s.order) return;
    s.order = key;
    for (const i of order) s.box.appendChild(s.items[i]); // 按前后顺序重排，前面的盖住后面的
  };

  let visible = false;
  let last = 0;
  let raf = 0;
  const frame = (now: number) => {
    const s = stages[radios.findIndex((r) => r.checked)];
    if (s && last) { s.t += Math.min(0.1, (now - last) / 1000); paint(s); }
    last = now;
    raf = visible ? requestAnimationFrame(frame) : 0;
  };

  let timer = 0;
  let touched = false;
  const stop = () => { clearInterval(timer); timer = 0; };
  const next = () => {
    const i = radios.findIndex((r) => r.checked);
    radios[(i + 1) % radios.length].checked = true;
  };
  for (const type of ['pointerdown', 'keydown']) viewer.addEventListener(type, () => { touched = true; stop(); });

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) { last = 0; raf = requestAnimationFrame(frame); }
    if (visible && !touched && !timer) timer = window.setInterval(next, 6000);
    else if (!visible) stop();
  }, { threshold: 0.3 }).observe(viewer);
}
