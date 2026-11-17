// 手机切页的三种动画（Web Animations）。旧页是 hooks/usePageTransition.ts 抓的 DOM 快照（.page-ghost），新页是真实的 #main。
// 横向切换：「景深平移」——顶栏不动、原位交叉淡化；内容里旧页缩小后退淡出，新页从侧后方推近，横向带一点远近层次。
// 推入：底下的页面先往里凹（缩小、圆角、变暗），子页再从右侧盖上来；弹出：整段倒放。样式见 styles/pagetransition.css。
// 推入 / 弹出用缓入缓出：强缓出曲线会在头几帧走完大半，看起来是「瞬间一跳、再慢慢挪」
const EASE_SLIDE = 'cubic-bezier(.4,0,.2,1)';
// 景深平移照样稿：旧页缓入缓出退场，新页缓出推近（中段关键帧已把位移摊开，新页同时从透明淡入，不显得跳）
const EASE_DEPTH_OUT = 'cubic-bezier(.45,0,.2,1)';
const EASE_DEPTH_IN = 'cubic-bezier(.2,.8,.2,1)';
const RECESSED = {transform: 'scale(.92)', borderRadius: '22px'};
const FLAT = {transform: 'scale(1)', borderRadius: '0px'};

const run = (list: Animation[], el: Element, kf: Keyframe[], ms: number, ease = EASE_SLIDE, delay = 0) => {
  list.push(el.animate(kf, {duration: ms, easing: ease, delay, fill: 'both'}));
};

// 顶栏不动：把两页的顶栏各复制一份钉在视口原位交叉淡化，页面里真正的顶栏在动画期间藏起来、跟着整页动也看不见
function pinHeads(ghost: HTMLElement, main: HTMLElement) {
  const layer = document.body.appendChild(document.createElement('div'));
  layer.className = 'page-head-layer';
  layer.setAttribute('aria-hidden', 'true');
  const hidden: HTMLElement[] = [];
  const pin = (h: HTMLElement | null) => {
    if (!h) return null;
    const r = h.getBoundingClientRect();
    const c = h.cloneNode(true) as HTMLElement;
    Object.assign(c.style, {position: 'absolute', margin: '0', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, transform: 'none'});
    h.style.visibility = 'hidden';
    hidden.push(h);
    return layer.appendChild(c);
  };
  const from = pin(ghost.querySelector<HTMLElement>('.page-head'));
  const to = pin(main.querySelector<HTMLElement>('.page-head'));
  return {from, to, cleanup: () => { layer.remove(); hidden.forEach(h => { h.style.visibility = ''; }); }};
}

/** 底栏之间「景深平移」（按样稿原参数，顶栏不动）：顶栏原位交叉淡化；下面的内容里，旧页（垫在下面的快照）缩小后退、淡出，
 *  新页从侧后方推近。dir = 1：新页在右边 */
export function playTab(ghost: HTMLElement, _scrim: HTMLElement, main: HTMLElement, dir: 1 | -1) {
  const list: Animation[] = [];
  // 先量顶栏位置（整页还没变形），再起动画
  const heads = pinHeads(ghost, main);
  if (heads.from) run(list, heads.from, [{opacity: 1}, {opacity: 0}], 160, 'ease-out');
  if (heads.to) run(list, heads.to, [{opacity: 0}, {opacity: 1}], 220, 'ease-out', 80);
  // 只动 transform 与 opacity，整段可交给合成线程；快照圆角是常驻样式，新页（比视口高）不裁圆角
  run(list, ghost, [{transform: 'translateX(0) scale(1)', opacity: 1},
    {transform: `translateX(${-dir * 16}%) scale(.88)`, opacity: .55, offset: .7},
    {transform: `translateX(${-dir * 22}%) scale(.86)`, opacity: 0}], 460, EASE_DEPTH_OUT);
  // main 比视口高：缩放原点放在视口里（与快照的 50% 45% 对齐），否则会绕整页中心缩、看起来往上下飘
  const top = scrollY - (main.getBoundingClientRect().top + scrollY);
  main.style.transformOrigin = `50% ${top + innerHeight * .45}px`;
  run(list, main, [{transform: `translateX(${dir * 26}%) scale(.88)`, opacity: 0},
    {transform: `translateX(${dir * 8}%) scale(.94)`, opacity: 1, offset: .45},
    {transform: 'translateX(0) scale(1)', opacity: 1}], 520, EASE_DEPTH_IN, 70);
  return {list, cleanup: () => { main.style.transformOrigin = ''; heads.cleanup(); }};
}

/** 进深一层：ghost 是垫在下面、视口大小的旧页快照，main 是盖上来的子页 */
export function playPush(ghost: HTMLElement, scrim: HTMLElement, main: HTMLElement) {
  const list: Animation[] = [];
  // 曲线同横向切换：缓入缓出，凹下与盖上来都不在头几帧就做完
  // 只动 transform：圆角在样式里常驻（满屏时圆角落在屏幕圆角里看不出），动画能整段交给合成线程，页面忙时也不卡
  // 节奏按样稿：底页先凹（340ms），子页晚 110ms 才出发——「先凹下、再出子页」要看得出先后
  run(list, ghost, [{transform: 'scale(1)'}, {transform: 'scale(.92)'}], 340, EASE_SLIDE);
  run(list, scrim, [{opacity: 0}, {opacity: 1}], 340, EASE_SLIDE);
  run(list, main, [{transform: 'translateX(100%)'}, {transform: 'translateX(0)'}], 440, EASE_SLIDE, 110);
  return {list, cleanup: () => {}};
}

/** 退回上一层：ghost 是盖在上面的子页快照，往右滑走；main 是从凹下恢复的上一级 */
export function playPop(ghost: HTMLElement, scrim: HTMLElement, main: HTMLElement) {
  const list: Animation[] = [];
  // main 比视口高：缩放原点放在视口中心，圆角只裁出视口里那一段
  const top = scrollY - (main.getBoundingClientRect().top + scrollY);
  const bottom = Math.max(0, main.offsetHeight - top - innerHeight);
  main.style.transformOrigin = `50% ${top + innerHeight * .45}px`;
  const clip = (r: number) => `inset(${top}px 0px ${bottom}px 0px round ${r}px)`;
  // 倒放：子页先滑走（360ms），上一级晚 120ms 再从凹下恢复（380ms）
  run(list, ghost, [{transform: 'translateX(0)'}, {transform: 'translateX(100%)'}], 360, EASE_SLIDE);
  run(list, main, [{transform: 'scale(.92)', clipPath: clip(22)}, {transform: 'scale(1)', clipPath: clip(0)}], 380, EASE_SLIDE, 120);
  run(list, scrim, [{opacity: 1, ...RECESSED}, {opacity: 0, ...FLAT}], 380, EASE_SLIDE, 120);
  return {list, cleanup: () => { main.style.transformOrigin = ''; }};
}

/** 减少动态效果：不做空间位移，旧页快照（盖在上面）与新页 120ms 线性交叉淡化 */
export function playFade(ghost: HTMLElement, main: HTMLElement) {
  const list: Animation[] = [];
  run(list, ghost, [{opacity: 1}, {opacity: 0}], 120, 'linear');
  run(list, main, [{opacity: 0}, {opacity: 1}], 120, 'linear');
  return {list, cleanup: () => {}};
}
