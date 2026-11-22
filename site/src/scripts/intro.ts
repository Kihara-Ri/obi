// 开屏动画（Intro.astro）：一个 requestAnimationFrame 时间轴驱动三层图标与中心孔遮罩，保证孔和黑胶始终同心。
// 只改 CSSOM（el.style.setProperty / transform），不写内联 style 属性，CSP 照旧。

const KEY = 'obi-intro-seen';
const CY = 176 / 512;   // 黑胶圆心在图标里的纵向位置
const HOLE = 13 / 512;  // 中心孔半径 / 图标边长
const T = { inEnd: 450, pullEnd: 1250, goStart: 1450, dropLen: 450, end: 2550 };

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const easeOut = (x: number) => 1 - (1 - x) ** 3;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const easeIn = (x: number) => x ** 3;

function seen(): boolean {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}
function markSeen(): void {
  try { sessionStorage.setItem(KEY, '1'); } catch { /* 隐私模式：下次照播 */ }
}

function play(root: HTMLElement): void {
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const rec = root.querySelector<HTMLElement>('[data-rec]')!;
  const drop = [root.querySelector<HTMLElement>('[data-back]')!, root.querySelector<HTMLElement>('[data-sleeve]')!];
  root.classList.add('run');

  const box = stage.getBoundingClientRect();
  const size = box.width;
  const lift = size * 0.42;                                    // 抽出的高度：黑胶整张离开封套
  const cx = box.left + size / 2;
  const cy = box.top + size * CY - lift;                       // 抽出后黑胶圆心的位置，之后就在这里放大
  const far = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy)); // 到最远屏幕角的距离
  const kEnd = far / (size * HOLE) * 1.05;                     // 孔盖满屏幕时的放大倍数

  let start = 0;
  let done = false;
  const finish = (fast: boolean) => {
    if (done) return;
    done = true;
    markSeen();
    if (!fast) { root.classList.add('gone'); return; }
    root.classList.add('skip');
    root.addEventListener('transitionend', () => root.classList.add('gone'), { once: true });
  };

  const frame = (now: number) => {
    if (done) return;
    if (!start) start = now;
    const t = now - start;

    const a = easeOut(seg(t, 0, T.inEnd));
    stage.style.opacity = String(a);
    stage.style.transform = `scale(${0.94 + 0.06 * a})`;

    const pull = easeInOut(seg(t, T.inEnd, T.pullEnd));
    const go = seg(t, T.goStart, T.end);
    const fall = easeIn(seg(t, T.goStart, T.goStart + T.dropLen));
    const scale = Math.exp(Math.log(kEnd) * easeIn(go)); // 在对数空间插值：放大的观感匀速
    rec.style.transform = `translateY(${-lift * pull}px) scale(${scale})`;
    for (const el of drop) {
      el.style.opacity = String(1 - fall);
      el.style.transform = `translateY(${size * 0.35 * fall}px)`;
    }
    if (go > 0) {
      root.classList.add('hole');
      root.style.setProperty('--cx', `${cx}px`);
      root.style.setProperty('--cy', `${cy}px`);
      root.style.setProperty('--r', `${size * HOLE * scale}px`);
    }
    if (t >= T.end) finish(false);
    else requestAnimationFrame(frame);
  };

  addEventListener('pointerdown', () => finish(true), { once: true });
  addEventListener('keydown', () => finish(true), { once: true });
  requestAnimationFrame(frame);
}

const root = document.querySelector<HTMLElement>('[data-intro]');
if (root) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still || seen()) root.classList.add('run', 'gone');
  else play(root);
}
