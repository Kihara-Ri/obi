// 手机左缘右划的共用手势核心：「更多」子页返回（hooks/useEdgeSwipeBack）与抽屉返回 / 下拉关闭（components/ui/Drawer）都经由这里，
// 起手判定、拦系统手势、方向锁定、速度与「算不算返回」的阈值只有这一份；跟手时画面怎么动由调用方决定。
//
// iOS：左缘起手若不在 touchstart 就 preventDefault，系统的「边缘返回」会在手指慢慢移动的那几帧里接管：
// 页面收到 touchcancel（内容瞬间弹回），随后系统播自己的返回动画（2026-10-24 账本页慢划失控）。所以起手即拦，
// 只放过贴边的按钮 / 链接（拦了会吞掉点击），它们由第一次 touchmove 再拦。

export const EDGE = 28;          // 起点距左缘 px
const LOCK = 8;                  // 位移超过它才判定方向
const COMMIT = .3, FLICK_DX = 30, FLICK_V = .45;   // 拖过宽度的比例，或甩动（px，px/ms）即算返回

/** 松手时是否算「返回」：两处统一口径 */
export const commitsBack = (dx: number, v: number, width: number) => dx > width * COMMIT || (dx > FLICK_DX && v > FLICK_V);

export interface EdgeSwipe {
  /** touchstart 时判定能否接管（抽屉打开、结算中等返回 false）；target 为起点元素 */
  canStart(target: Element | null): boolean;
  /** 方向锁定为右划、开始跟手 */
  begin(): void;
  move(dx: number): void;
  /** 正常松手：dx 位移、v 末段速度（px/ms） */
  end(dx: number, v: number): void;
  /** 手势被打断（系统 touchcancel、多指、丢了 touchend）：调用方回弹 */
  cancel(): void;
}

export function installEdgeSwipe(h: EdgeSwipe): () => void {
  let start: {x: number; y: number} | null = null;
  let active = false, dx = 0, v = 0, lastX = 0, lastT = 0;
  const abort = () => {
    const was = active;
    start = null; active = false;
    if (was) h.cancel();
  };
  const onStart = (e: TouchEvent) => {
    // 上一次的 touchend 丢了（触点节点被重渲染移出文档时冒不到 document）：先回弹收尾
    if (start && e.touches.length === 1) abort();
    const t = e.touches[0];
    if (e.touches.length !== 1 || t.clientX > EDGE) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!h.canStart(target)) return;
    // 起点在「已向右滚过」的横向条带里：让位给原生横向滚动
    for (let n = target; n && n !== document.body; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 1 && n.scrollLeft > 0) return;
    }
    if (e.cancelable && !target?.closest('button, a')) e.preventDefault();
    start = {x: t.clientX, y: t.clientY};
    active = false; dx = 0; v = 0; lastX = t.clientX; lastT = e.timeStamp;
  };
  const onMove = (e: TouchEvent) => {
    if (!start) return;
    if (e.touches.length > 1) { abort(); return; }   // 捏合等多指手势不接管
    const t = e.touches[0];
    const ddx = t.clientX - start.x, ddy = t.clientY - start.y;
    if (!active) {
      // 判定方向之前也要拦：慢慢移动的这几帧正是系统手势起步的时机
      if (e.cancelable) e.preventDefault();
      if (Math.abs(ddx) < LOCK && Math.abs(ddy) < LOCK) return;
      if (ddx <= 0 || Math.abs(ddx) <= Math.abs(ddy)) { start = null; return; }
      active = true;
      h.begin();
    }
    if (e.cancelable) e.preventDefault();
    dx = Math.max(0, ddx);
    const dt = e.timeStamp - lastT;
    if (dt > 0) { v = (t.clientX - lastX) / dt; lastX = t.clientX; lastT = e.timeStamp; }
    h.move(dx);
  };
  const onEnd = () => {
    if (!start) return;
    start = null;
    if (!active) return;
    active = false;
    h.end(dx, v);
  };
  // touchstart 必须 capture：iOS 键盘弹出时 WebKit 只把 touchstart 派发到捕获阶段（冒泡阶段收不到，实测）
  document.addEventListener('touchstart', onStart, {passive: false, capture: true});
  document.addEventListener('touchmove', onMove, {passive: false});
  document.addEventListener('touchend', onEnd, {passive: true});
  document.addEventListener('touchcancel', abort, {passive: true});
  return () => {
    document.removeEventListener('touchstart', onStart, true);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.removeEventListener('touchcancel', abort);
  };
}
