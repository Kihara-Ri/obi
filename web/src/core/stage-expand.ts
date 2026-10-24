// 收藏展示 ↔ 沉浸展示：展示舞台（专辑所在的容器）向上 / 向下伸缩，页面标题、控件、底栏（或侧栏）向外移出 / 移回。
// 全程在普通版式里用真实布局做动画：舞台靠负外边距长到整屏（专辑随容器自然重排，不裁剪、不拆层、不改 z-index），
// 其余界面靠 transform 滑出屏幕；动画结束再切换成沉浸版式，两边几何一致，所以切换那一帧画面不变。
export type Motion = {finished: Promise<unknown>; cancel(): void};
/** 要滑出屏幕的界面元素与滑出后的 transform */
export type Exit = {el: HTMLElement; to: string};
export type Geometry = {normal: DOMRect; full: DOMRect; exits: Exit[]};

const DURATION = 420;
const EASING = 'cubic-bezier(.2,.8,.2,1)';
const GAP = 12;

export const prefersReducedMotion = () => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

const shown = (el: Element | null): el is HTMLElement => Boolean(el) && getComputedStyle(el as Element).display !== 'none';

/** 普通版式里的几何：页面里每个要移出的元素往哪个方向滑 */
export function measureExits(page: HTMLElement): Exit[] {
  const exits: Exit[] = [];
  const top = Math.max(0, ...[...page.querySelectorAll<HTMLElement>(':scope>.page-head,:scope>.gallery-controls')].map(e => e.getBoundingClientRect().bottom));
  page.querySelectorAll<HTMLElement>(':scope>.page-head,:scope>.gallery-controls').forEach(el => exits.push({el, to: `translateY(${-(top + GAP)}px)`}));
  const side = document.querySelector('.sidebar'), nav = document.querySelector('.mobile-nav');
  if (shown(side)) exits.push({el: side, to: `translateX(${-(side.getBoundingClientRect().right + GAP)}px)`});
  if (shown(nav)) exits.push({el: nav, to: `translateY(${innerHeight - nav.getBoundingClientRect().top + GAP}px)`});
  return exits;
}

/** 舞台在 k=0（普通）/ k=1（整屏）之间的外边距：负外边距让弹性布局把舞台撑到屏幕边缘 */
const margins = ({normal, full}: Geometry, k: number) => ({
  marginTop: `${(full.top - normal.top) * k}px`, marginBottom: `${(normal.bottom - full.bottom) * k}px`,
  marginLeft: `${(full.left - normal.left) * k}px`, marginRight: `${(normal.right - full.right) * k}px`,
});

/** reverse=false：普通 → 沉浸（进入）；reverse=true：沉浸 → 普通（退出）。都从普通版式出发 / 结束，由调用方切换版式。 */
export function runStage(stage: HTMLElement, g: Geometry, reverse: boolean): Motion {
  const opts: KeyframeAnimationOptions = {duration: DURATION, easing: EASING, fill: 'forwards', direction: reverse ? 'reverse' : 'normal'};
  const anims = [
    stage.animate([margins(g, 0), margins(g, 1)], opts),
    ...g.exits.map(({el, to}) => el.animate([{transform: 'none'}, {transform: to}], opts)),
  ];
  return {finished: anims[0].finished, cancel: () => anims.forEach(a => a.cancel())};
}
