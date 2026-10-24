// 收藏展示 ↔ 沉浸展示：展示舞台（专辑所在的容器）本身向上 / 向下伸缩，专辑随容器一起运动。
// 用 transform 位移 + clip-path 裁剪在 GPU 上做动画：不拆层、不改 z-index，也不会盖住别的控件。
// 进入：先切到沉浸版式，再让舞台从旧位置的范围「长」到整屏；退出：舞台在沉浸版式里「缩」回展开前的位置，结束时再切回普通版式。
// 两端用同一锚点对齐（居中布局对齐中心，其余对齐上缘），所以切换版式的那一帧画面是连续的。
export type StageAnchor = 'center' | 'top';

const DURATION = 420;
const EASING = 'cubic-bezier(.2,.8,.2,1)';

export const prefersReducedMotion = () => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** 只取落在屏幕内的部分：整面封面墙可能比屏幕高得多，裁剪窗口以可见区域为准 */
function visible(r: DOMRect): DOMRect {
  const left = Math.max(r.left, 0), top = Math.max(r.top, 0);
  return new DOMRect(left, top, Math.max(0, Math.min(r.right, innerWidth) - left), Math.max(0, Math.min(r.bottom, innerHeight) - top));
}

/** 把舞台（当前几何 = to）动画成「看起来占据 from」：from 是屏幕坐标，clip-path 以舞台自身坐标计 */
function frame(from: DOMRect, to: DOMRect, anchor: StageAnchor) {
  const dx = anchor === 'center' ? from.left + from.width / 2 - (to.left + to.width / 2) : from.left - to.left;
  const dy = anchor === 'center' ? from.top + from.height / 2 - (to.top + to.height / 2) : from.top - to.top;
  const v = visible(from);
  const inset = [v.top - dy - to.top, to.right - (v.right - dx), to.bottom - (v.bottom - dy), v.left - dx - to.left]
    .map(n => `${Math.round(n * 10) / 10}px`).join(' ');
  return {transform: `translate(${dx}px,${dy}px)`, clipPath: `inset(${inset})`};
}

const REST = {transform: 'translate(0,0)', clipPath: 'inset(0px)'};

/** from → 当前位置（进入）。返回动画，可被 cancel() 打断 */
export function growStage(stage: HTMLElement, from: DOMRect, anchor: StageAnchor): Animation {
  return stage.animate([frame(from, stage.getBoundingClientRect(), anchor), REST], {duration: DURATION, easing: EASING});
}

/** 当前位置 → to（退出）；保持在终点（fill: forwards），由调用方在切回普通版式后 cancel() */
export function shrinkStage(stage: HTMLElement, to: DOMRect, anchor: StageAnchor): Animation {
  return stage.animate([REST, frame(to, stage.getBoundingClientRect(), anchor)], {duration: DURATION, easing: EASING, fill: 'forwards'});
}
