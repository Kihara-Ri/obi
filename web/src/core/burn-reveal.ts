// 封面「燃烧显现」：真实封面加载完成后不瞬间出现，而是像火从四边向中心蔓延：
// 已烧过的地方露出封面，火线上有一圈橙黄的余烬，边缘随噪声参差不齐。
// 实现：低分辨率（GRID×GRID）的透明度图作 CSS mask 套在图上，余烬画在盖在图上方的小画布里，逐帧更新；
// 画布只读写自己生成的像素，不碰跨域图片数据。减少动态效果或不支持 mask 时直接显示。
import {smootherstep} from './gallery-motion';

const GRID = 40, BAND = .34, DURATION = 950;
let noise: Float32Array | null = null;

function makeNoise(): Float32Array {
  const raw = new Float32Array(GRID * GRID).map(() => Math.random());
  let a = raw;
  for (let pass = 0; pass < 2; pass++) {   // 两次 3×3 均值：相邻格子连续，火线才有起伏而不是雪花点
    const b = new Float32Array(a.length);
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      let sum = 0, count = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < GRID && yy < GRID) {sum += a[yy * GRID + xx]; count++;}
      }
      b[y * GRID + x] = sum / count;
    }
    a = b;
  }
  let lo = 1, hi = 0;
  a.forEach(v => {lo = Math.min(lo, v); hi = Math.max(hi, v);});
  return a.map(v => (v - lo) / Math.max(1e-6, hi - lo));
}

/** 每个格子的「着火时刻」：离最近边越近越早，再叠加噪声 */
function ignition(): Float32Array {
  noise ||= makeNoise();
  const t = new Float32Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    const edge = Math.min(x, y, GRID - 1 - x, GRID - 1 - y) / (GRID / 2);
    t[y * GRID + x] = Math.min(1, edge) * .66 + noise[y * GRID + x] * .34;
  }
  return t;
}

const supportsMask = () => typeof CSS !== 'undefined' && (CSS.supports('mask-image', 'linear-gradient(black,black)')
  || CSS.supports('-webkit-mask-image', 'linear-gradient(black,black)'));

function setMask(img: HTMLElement, url: string | null) {
  const v = url ? `url(${url})` : '';
  img.style.setProperty('-webkit-mask-image', v); img.style.setProperty('mask-image', v);
  const size = url ? '100% 100%' : '';
  img.style.setProperty('-webkit-mask-size', size); img.style.setProperty('mask-size', size);
}

/** 在图片首次加载完成时调用（图片此时仍是 hidden）。返回后图片已被遮住，动画随后自行播放。 */
export function burnReveal(img: HTMLImageElement) {
  try {burn(img);} catch {setMask(img, null);}   // 动画只是装饰：任何环境出错都直接显示封面
}

function burn(img: HTMLImageElement) {
  if (img.dataset.burned) return;
  img.dataset.burned = '1';
  let reduced = false;
  try {reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;} catch { /* 取不到就当作可以动画 */ }
  if (reduced || !supportsMask()) return;
  const mask = document.createElement('canvas'); mask.width = mask.height = GRID;
  const mctx = mask.getContext('2d');
  const glow = document.createElement('canvas'); glow.width = glow.height = GRID;
  const gctx = glow.getContext('2d');
  if (!mctx || !gctx) return;
  const maskData = mctx.createImageData(GRID, GRID), glowData = gctx.createImageData(GRID, GRID);
  const fire = ignition();
  const paint = (p: number) => {
    for (let i = 0; i < fire.length; i++) {
      const s = (p - fire[i]) / BAND;                 // <0 未着火，0..1 火线，>1 已烧过
      maskData.data[i * 4 + 3] = Math.round(255 * Math.max(0, Math.min(1, s * 1.35)));
      const g = s > 0 && s < 1 ? Math.sin(Math.PI * Math.pow(s, .7)) : 0;
      glowData.data[i * 4] = 255; glowData.data[i * 4 + 1] = Math.round(90 + 150 * (1 - s));
      glowData.data[i * 4 + 2] = Math.round(30 * (1 - s)); glowData.data[i * 4 + 3] = Math.round(235 * g);
    }
    mctx.putImageData(maskData, 0, 0); gctx.putImageData(glowData, 0, 0);
    setMask(img, mask.toDataURL());
  };
  paint(0);
  let overlay: HTMLCanvasElement | null = null;
  let start = 0;
  const cleanup = () => {setMask(img, null); overlay?.remove(); overlay = null;};
  const tick = (at: number) => {
    if (!img.isConnected) {cleanup(); return;}
    if (!start) {
      start = at;
      const parent = img.parentElement;
      if (parent && img.offsetWidth) {
        overlay = document.createElement('canvas'); overlay.width = overlay.height = GRID;
        overlay.setAttribute('aria-hidden', 'true'); overlay.className = 'burn-ember';
        Object.assign(overlay.style, {position: 'absolute', pointerEvents: 'none', borderRadius: getComputedStyle(img).borderRadius,
          left: img.offsetLeft + 'px', top: img.offsetTop + 'px', width: img.offsetWidth + 'px', height: img.offsetHeight + 'px',
          mixBlendMode: 'screen', filter: 'blur(1.5px)'});
        parent.insertBefore(overlay, img.nextSibling);
      }
    }
    const t = Math.min(1, (at - start) / DURATION);
    const p = smootherstep(t) * (1 + BAND);
    paint(p);
    overlay?.getContext('2d')?.clearRect(0, 0, GRID, GRID);
    overlay?.getContext('2d')?.drawImage(glow, 0, 0);
    if (t < 1) requestAnimationFrame(tick); else cleanup();
  };
  requestAnimationFrame(tick);
  window.setTimeout(() => {if (img.style.maskImage || img.style.getPropertyValue('-webkit-mask-image')) cleanup();}, DURATION + 1500);   // 兜底：后台标签页暂停 rAF 时也不能让封面一直被遮住
}
