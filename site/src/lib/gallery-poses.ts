// 九种展示布局的预览姿态：给定布局、第 i 张、时间 t（秒），返回这张封面在 300×200 画布上的位置与形变。
// 服务端用 t=0 画出静态首帧，scripts/layouts.ts 用同一套函数逐帧驱动，所以两边永远一致。
// 外观照应用的定案（docs/界面与功能定案.md「各布局外观」）缩成小样，不追求逐像素一致。
export type Mode = 'wall' | 'waterfall' | 'film' | 'flip' | 'crate' | 'desk' | 'fan' | 'iso' | 'ring';
export interface Pose { x: number; y: number; s: number; r?: number; k?: number; sx?: number; sy?: number; o?: number; dim?: number; hl?: number; z?: number }

export const LAYOUTS: { name: string; mode: Mode }[] = [
  { name: '封面墙', mode: 'wall' }, { name: '瀑布流', mode: 'waterfall' }, { name: '胶片', mode: 'film' },
  { name: '翻阅', mode: 'flip' }, { name: '唱片箱', mode: 'crate' }, { name: '桌面铺开', mode: 'desk' },
  { name: '扇形展开', mode: 'fan' }, { name: '等距封面墙', mode: 'iso' }, { name: '环形展架', mode: 'ring' },
];

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const easeIO = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const wrap = (v: number, lo: number, len: number) => lo + ((((v - lo) % len) + len) % len);
const hash = (i: number) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
/** 中心布局的进度：每 T 秒先停留，再用缓入缓出换到下一张 */
const step = (t: number, T: number, hold = 0.55) => { const n = Math.floor(t / T); return n + easeIO(clamp((t / T - n - hold) / (1 - hold))); };

// 瀑布流：四列等宽，封面按序号稳定取「满宽 / 偏左 / 偏右 / 居中」一档，下方两行标题；各列错开起点、各自匀速上移
const WF_SIZES = ['full', 'full', 'left', 'left', 'right', 'right', 'center'] as const;
const WF_COL = 66, WF_GAP = 10, WF_CAPTION = 22, WF_OFF = [0, 13, 5, 13], WF_SPEED = [8, 11, 9, 12];
const waterfall = (() => {
  const items: { c: number; x: number; y: number; w: number }[] = [];
  const periods: number[] = [];
  for (let c = 0; c < 4; c++) {
    let y = WF_OFF[c];
    while (y - WF_OFF[c] < 330) {
      const v = WF_SIZES[Math.floor(hash(items.length + 7) * WF_SIZES.length)];
      const w = v === 'full' ? WF_COL : v === 'center' ? WF_COL * 0.74 : WF_COL * 0.84;
      const x0 = 3 + c * (WF_COL + WF_GAP);
      items.push({ c, w, y, x: v === 'right' ? x0 + WF_COL - w : v === 'center' ? x0 + (WF_COL - w) / 2 : x0 });
      y += w + WF_CAPTION + 10;
    }
    periods.push(y - WF_OFF[c]);
  }
  return { items, periods };
})();

/** 每种布局渲染多少个封面槽位 */
export const COUNT: Record<Mode, number> = {
  wall: 30, waterfall: waterfall.items.length, film: 30, flip: 9, crate: 8, desk: 15, fan: 9, iso: 49, ring: 10,
};
/** 需要按 z 重排前后顺序的布局 */
export const LAYERED: Mode[] = ['flip', 'crate', 'fan', 'ring'];

export function pose(mode: Mode, i: number, t: number): Pose {
  switch (mode) {
    case 'wall': { // 六列网格整体匀速上移，循环
      const col = i % 6, row = Math.floor(i / 6);
      return { x: 5.5 + col * 49, y: wrap(row * 49 + 6 - t * 9, -50, 245), s: 44 };
    }
    case 'waterfall': {
      const it = waterfall.items[i];
      return { x: it.x, y: wrap(it.y - t * WF_SPEED[it.c], -110, waterfall.periods[it.c]), s: it.w };
    }
    case 'film': { // 前 15 张是约 40% 宽的大封面横向连续滚动，后 15 张是下方印样条，同步移动、当前一张对准中间的框
      const big = i < 15, j = big ? i : i - 15;
      if (big) return { x: wrap(j * 132 + 91 - t * 20, -140, 1980), y: 14, s: 118 };
      return { x: wrap(j * 22 + 141 - t * 20 * 22 / 132, -30, 330), y: 159, s: 18 };
    }
    case 'flip': { // 中心大、两侧各露两张并侧转，带地面倒影
      const d = wrap(i - step(t, 2.4), -4.5, 9), a = Math.abs(d), n = Math.min(a, 1), sg = Math.sign(d);
      const s = 92 - 30 * n, cx = 150 + sg * (n * 78 + Math.max(0, a - 1) * 36);
      return { x: cx - s / 2, y: 124 - s, s, k: sg * 12 * n, sx: 1 - 0.28 * n, o: clamp(3.1 - a), dim: 0.1 * Math.min(a, 3), z: -a };
    }
    case 'crate': { // 唱片竖着插在木箱里，前挡板挡住下部；最前一张向前倒下淡出，后面的依次上前
      const d = wrap(i - step(t, 2.6, 0.5), -1, 8);
      if (d < 0) {
        const sy = 1 + d * 0.85, s = 120;
        return { x: 90, y: 176 - s + (s * (1 - sy)) / 2 - d * 8, s, sy, o: clamp(1 + d * 1.15), z: 1 };
      }
      const s = 120 - d * 7;
      return { x: 150 - s / 2, y: 56 - d * 8, s, dim: Math.min(0.7, d * 0.13), o: clamp(5.6 - d), z: -d };
    }
    case 'desk': { // 木纹桌面上随手散放（±8° 与错位），整桌缓缓向下铺开
      const col = i % 3, row = Math.floor(i / 3);
      return { x: 26 + col * 90 + (hash(i) - 0.5) * 26, y: wrap(row * 66 + (hash(i + 31) - 0.5) * 14 - t * 10, -80, 330), s: 60, r: (hash(i + 57) - 0.5) * 16 };
    }
    case 'fan': { // 绕下方一点展开成扇形：中心与紧邻一张保持原弧线，外侧收紧
      const d = wrap(i - step(t, 2.2), -4.5, 9), a = Math.abs(d), sg = Math.sign(d);
      const th = sg * (a <= 1 ? a * 15 : 15 + (a - 1) * 8), rad = (th * Math.PI) / 180, s = 84 - 10 * Math.min(a, 1);
      return { x: 150 + 210 * Math.sin(rad) - s / 2, y: 300 - 210 * Math.cos(rad) - s / 2, s, r: th, o: clamp(3.8 - a), dim: 0.08 * Math.min(a, 3), z: -a };
    }
    case 'iso': { // 斜放的封面墙沿左上↔右下无限移动，最靠中心的一张抬起并描边
      const col = i % 7, row = Math.floor(i / 7);
      const x = wrap(col * 54 - t * 12, -200, 378), y = wrap(row * 54 - t * 12, -200, 378);
      const hl = clamp(1 - Math.hypot(x + 23, y + 23) / 34);
      return { x: x - 3 * hl, y: y - 5 * hl, s: 46, hl };
    }
    case 'ring': { // 椭圆底座上的一圈封面：转到前面变大变亮，转到后面变小变暗
      const th = ((i - step(t, 2.4)) * 2 * Math.PI) / 10, c = Math.cos(th);
      const s = 40 + 56 * (c + 1) / 2, bottom = 142 + 28 * c;
      return { x: 150 + 118 * Math.sin(th) - s / 2, y: bottom - s, s, dim: 0.6 * (1 - c) / 2, z: c };
    }
  }
}

const f = (v: number) => Math.round(v * 100) / 100;
/** 姿态 → SVG transform：封面内容是 100×100，绕自身中心旋转、斜切、缩放 */
export function transform(p: Pose): string {
  const h = p.s / 2;
  return `translate(${f(p.x + h)} ${f(p.y + h)}) rotate(${f(p.r ?? 0)}) skewY(${f(p.k ?? 0)}) scale(${f(((p.sx ?? 1) * p.s) / 100)} ${f(((p.sy ?? 1) * p.s) / 100)}) translate(-50 -50)`;
}

/** 按 z 从后往前的绘制顺序 */
export const order = (mode: Mode, t: number): number[] =>
  Array.from({ length: COUNT[mode] }, (_, i) => i).sort((a, b) => (pose(mode, a, t).z ?? 0) - (pose(mode, b, t).z ?? 0));
