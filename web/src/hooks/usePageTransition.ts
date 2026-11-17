// 手机页面切换动画与库存 ↔ 展示的幕布（PageVeil）。两页之间是什么关系由 core/page-motion.ts 判定，
// 动画本身在 core/page-transition-play.ts（样式见 styles/pagetransition.css）。
// 返回挂到 #main 的 ref 与幕布要预加载的封面；桌面不做切换动画，prefers-reduced-motion 只做 120ms 交叉淡化。
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {AppState, ModuleFlags} from '../types';
import {useEdgeSwipeBack} from './useEdgeSwipeBack';
import {mobileTabOrder, pageMotion} from '../core/page-motion';
import {playFade, playPop, playPush, playTab} from '../core/page-transition-play';
import {freezeImages} from '../core/ghost-images';

const isShelf = (p: string) => p === 'domestic' || p === 'overseas';

// 快照只用来淡出 150ms：视口下方的内容整段不要，视口上方（已滚过）的只留占位高度，视口内的原样保留。
// 只按纵向裁剪；以成对遍历 source 与克隆的直接子节点，递归进与视口相交的子树。
const PRUNE_MARGIN = 40;
function pruneOffscreen(src: Element, clone: Element) {
  const vh = window.innerHeight;
  const sk = Array.from(src.children), ck = Array.from(clone.children);
  sk.forEach((s, i) => {
    const c = ck[i];
    if (!c || sk.length !== ck.length) return;
    const r = s.getBoundingClientRect();
    if (r.height === 0) return;
    if (r.top >= vh + PRUNE_MARGIN) { c.remove(); return; }
    if (r.bottom <= -PRUNE_MARGIN) {
      if (c.children.length) { c.replaceChildren(); (c as HTMLElement).style.height = r.height + 'px'; }
      return;
    }
    pruneOffscreen(s, c);
  });
}

/** showcaseTab：以展示为主（展示是底栏标签），库存 ↔ 展示按普通换页处理；modules：决定底栏有哪些标签（切页方向按底栏顺序算） */
export function usePageTransition(page: string, showcaseTab: boolean, records: AppState['records'] | undefined, modules: ModuleFlags | undefined) {
  // 旧页面以 DOM 快照参与滑出，组件不重复挂载。hashchange/popstate 在 React 重渲染前同步到达，
  // 监听里抢先抓整个 #main 的克隆（连内边距一起保住几何）；等 effect 跑起来时旧内容已被换掉，只能用这份快照。
  useEdgeSwipeBack(page);   // 子页左缘右划返回：同属页面切换，随这个 hook 一起挂
  const mainRef = useRef<HTMLElement | null>(null);
  const prevPageRef = useRef(page);
  const orderRef = useRef<string[]>([]);
  orderRef.current = modules ? mobileTabOrder(modules, showcaseTab) : [];
  const ghostSnapRef = useRef<{el: HTMLElement; els: HTMLElement[]; y: number;
    scroll: {index: number; left: number; top: number}[];
    poses: {index: number; name: string; time: number}[]} | null>(null);
  const lastHashRef = useRef(location.hash);
  const clickNavRef = useRef(0);
  const historyNavRef = useRef(false);
  useEffect(() => {
    const capture = () => {
      // 滚动偏移必须此刻记下：换页后内容变矮会被视口钳到 0，快照就对不上用户看到的位置了
      const source = mainRef.current;
      const el = source?.cloneNode(true) as HTMLElement | undefined;
      // 先记下克隆里每个节点的引用（与 source 的 querySelectorAll('*') 同序），再裁剪：下面的滚动 / 动画姿态按这个序号回填
      const els = el ? Array.from(el.querySelectorAll<HTMLElement>('*')) : [];
      // 视口里的封面换成从原图画好的 canvas（见 core/ghost-images.ts），否则第一帧是空白——旧页封面闪一下
      if (source && el) freezeImages(Array.from(source.querySelectorAll('*')), els);
      if (source && el) pruneOffscreen(source, el);
      ghostSnapRef.current = source && el ? {
        el, els, y: window.scrollY,
        // cloneNode 不复制内部滚动偏移；快照挂载后才能还原可滚动容器的位置。
        scroll: Array.from(source.querySelectorAll<HTMLElement>('*')).flatMap((el, index) =>
          el.scrollLeft || el.scrollTop ? [{index, left: el.scrollLeft, top: el.scrollTop}] : []),
        // 连续展示以暂停 CSS 动画定位；克隆同样要保留当前姿态，避免切页时封面跳回起点。
        poses: Array.from(source.querySelectorAll<HTMLElement>('*')).flatMap((el, index) =>
          el.getAnimations().flatMap(animation => animation.playState === 'paused'
            && typeof animation.currentTime === 'number' && 'animationName' in animation
            ? [{index, name: (animation as CSSAnimation).animationName, time: animation.currentTime}] : [])),
      } : null;
    };
    // 真正的历史遍历（iOS 边缘右滑、后退/前进）系统自带过渡画面，自己再播一遍
    // 就是双重动画——标记后由切页 effect 跳过。**WebKit 对锚点点击的 fragment
    // 导航也会连发两次 popstate**（实测序列 pop、pop、hash，与历史返回无法从
    // 事件本身区分），只能靠点击时间窗判别：点击后瞬间的 popstate 是应用内导航。
    const onPop = () => {
      if (location.hash !== lastHashRef.current && Date.now() - clickNavRef.current > 500) {
        historyNavRef.current = true;
      }
      capture();
    };
    const onHash = () => {
      lastHashRef.current = location.hash;
      capture();
    };
    const onClick = () => { clickNavRef.current = Date.now(); };
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onHash);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);
  // 库存 ↔ 展示：幕布合上 → 预加载封面 → 打开（PageVeil）。必须在绘制前挂上，
  // 否则新页面会先闪一帧；layout effect 在下面的切页 effect 之前运行，能读到旧页面。
  const [veil, setVeil] = useState<string[] | null>(null);
  const veilStartedRef = useRef(false);
  useLayoutEffect(() => {
    veilStartedRef.current = false;
    const prev = prevPageRef.current;
    if (prev === page || !((prev === 'gallery' && isShelf(page)) || (page === 'gallery' && isShelf(prev)))) return;
    if (historyNavRef.current || showcaseTab) return;
    try {
      if (!matchMedia('(max-width:840px)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch { return; }
    veilStartedRef.current = true;
    setVeil((records ?? []).map(r => r.cover).filter(Boolean));
  }, [page]);
  // 必须是 layout effect：页面内容经 useDeferredValue 延后提交，passive effect 会落在新页面首帧绘制之后，
  // 快照 / 淡入类名来晚一帧，就是切页时那一下闪。
  useLayoutEffect(() => {
    const prev = prevPageRef.current;
    prevPageRef.current = page;
    const main = mainRef.current;
    if (prev === page || !main) { ghostSnapRef.current = null; return; }
    const motion = pageMotion(prev, page, orderRef.current, showcaseTab);
    // 国内 / 海外是同一张库存页里的两个子标签（.shelf-location），切换不算换页：只有列表内容替换与地区下划线滑动。
    if (motion.kind === 'none') { ghostSnapRef.current = null; return; }
    const snap = ghostSnapRef.current;
    ghostSnapRef.current = null;
    const swiped = document.documentElement.dataset.swipeBack;   // 左缘右划返回：垫底页已经露出来了，不再播
    delete document.documentElement.dataset.swipeBack;
    const fromHistory = historyNavRef.current;
    historyNavRef.current = false;
    let mobile = false;
    let animate = true;
    try {
      mobile = matchMedia('(max-width:840px)').matches;
      animate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { animate = false; }
    if (veilStartedRef.current) return;   // 已由 PageVeil 接管整场转场
    // 库存 ↔ 展示（以管理为主的用户用顶栏切换进入）：顶栏留在原地，只让下方内容柔和淡入（切换控件的滑块自己滑过去）
    if (motion.kind === 'switch') {
      if (!mobile || !animate || fromHistory || swiped) return;
      main.classList.add('page-in-fade');
      const t = window.setTimeout(() => main.classList.remove('page-in-fade'), 400);
      return () => { window.clearTimeout(t); main.classList.remove('page-in-fade'); };
    }
    if (!snap || !mobile || swiped) return;
    // 浏览器历史遍历（后退 / 前进键）多半自带过渡，不再自播；只有退回上一层要播：
    // 安卓返回键没有系统动画，iOS 子页不压历史（core/nav.ts），不会走到这里。
    if (fromHistory && motion.kind !== 'pop') return;
    const ghost = document.createElement('div');
    ghost.className = `page-ghost page-ghost-${animate ? motion.kind : 'fade'}`;
    ghost.setAttribute('aria-hidden', 'true');
    const shifter = document.createElement('div');
    shifter.className = 'page-ghost-shift';
    shifter.style.transform = `translateY(${-snap.y}px)`;
    // 快照不随窗口滚动：按抓取时的滚动偏移还原，吸顶页头停在用户此刻看到的位置
    snap.el.querySelectorAll<HTMLElement>('.page-head').forEach(h => { h.style.transform = `translateY(${snap.y}px)`; });
    shifter.appendChild(snap.el);
    ghost.appendChild(shifter);
    // 推入 / 弹出：页面凹下时露出的底色；三种都有压暗层（横向切换与推入在快照里，弹出盖在 #main 上）
    const extras: HTMLElement[] = [];
    const extra = (cls: string) => { const e = document.createElement('div'); e.className = cls; e.setAttribute('aria-hidden', 'true'); extras.push(e); return e; };
    if (animate && motion.kind !== 'tab') document.body.appendChild(extra('page-recess-bg'));
    document.body.appendChild(ghost);
    const scrim = animate && motion.kind === 'pop' ? document.body.insertBefore(extra('page-recess-scrim is-over-main'), ghost)
      : ghost.appendChild(extra('page-recess-scrim'));
    const clonedElements = snap.els;
    snap.scroll.forEach(({index, left, top}) => {
      clonedElements[index].scrollLeft = left;
      clonedElements[index].scrollTop = top;
    });
    snap.poses.forEach(({index, name, time}) => {
      clonedElements[index].getAnimations().forEach(animation => {
        if ('animationName' in animation && (animation as CSSAnimation).animationName === name) animation.currentTime = time;
      });
    });
    const moving = animate ? {tab: 'page-tabbing', push: 'page-pushing', pop: 'page-popping'}[motion.kind] : 'page-fading';
    main.classList.add(moving);
    document.documentElement.classList.add('page-anim-lock');
    const play = !animate ? playFade(ghost, main) : motion.kind === 'tab' ? playTab(ghost, scrim, main, motion.dir)
      : motion.kind === 'push' ? playPush(ghost, scrim, main) : playPop(ghost, scrim, main);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      play.list.forEach(a => a.cancel());
      play.cleanup();
      ghost.remove();
      extras.forEach(e => e.remove());
      main.classList.remove(moving);
      document.documentElement.classList.remove('page-anim-lock');
    };
    Promise.all(play.list.map(a => a.finished)).then(finish, () => {});
    const timer = window.setTimeout(finish, 1200);   // 兜底：收不到结束事件（如页面转入后台）也收尾
    return () => { window.clearTimeout(timer); finish(); };   // 快速连切：立刻收掉上一场过渡
  }, [page]);

  return {mainRef, veil, setVeil};
}
