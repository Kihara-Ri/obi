// 手机页面切换动画（样式见 styles/pagetransition.css）与库存 ↔ 展示的幕布（PageVeil）。
// 返回挂到 #main 的 ref 与幕布要预加载的封面；桌面与 prefers-reduced-motion 不做切换动画。
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {AppState} from '../types';

// 空间方向：rank 是页面在横向层级里的位置（底栏从左到右，
// 「更多」的子页比「更多」更深，回收站从设置进入）。进入更深的页面从右侧推入，
// 向左返回时当前页向右滑出。
const PAGE_RANK: Record<string, number> = {
  domestic: 0, overseas: .5, gallery: 1, transit: 2, shipping: 3,
  more: 4, lookup: 4.1, trades: 4.2, stats: 4.3, settings: 4.4, trash: 4.5,
};

// 以展示为主时底栏是「展示 · 收藏 · 更多」，展示在收藏左边，方向要跟着底栏走
const rankOf = (p: string, showcaseTab: boolean) => p === 'gallery' && showcaseTab ? -1 : PAGE_RANK[p] ?? 3.5;

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

/** showcaseTab：以展示为主（展示是底栏标签），库存 ↔ 展示按普通换页处理 */
export function usePageTransition(page: string, showcaseTab: boolean, records: AppState['records'] | undefined) {
  // 旧页面以 DOM 快照参与滑出，组件不重复挂载。hashchange/popstate 在 React 重渲染前同步到达，
  // 监听里抢先抓整个 #main 的克隆（连内边距一起保住几何）；等 effect 跑起来时旧内容已被换掉，只能用这份快照。
  const mainRef = useRef<HTMLElement | null>(null);
  const prevPageRef = useRef(page);
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
  useEffect(() => {
    const prev = prevPageRef.current;
    prevPageRef.current = page;
    const main = mainRef.current;
    if (prev === page || !main) { ghostSnapRef.current = null; return; }
    // 国内 / 海外是同一张库存页里的两个子标签（.shelf-location），切换不算换页：
    // 不播整页过渡，只有列表内容替换与地区下划线滑动。
    if (isShelf(prev) && isShelf(page)) {
      ghostSnapRef.current = null;
      return;
    }
    const snap = ghostSnapRef.current;
    ghostSnapRef.current = null;
    // 历史驱动的换页（边缘右滑/后退键）交给系统过渡，自己不再播动画
    const fromHistory = historyNavRef.current;
    historyNavRef.current = false;
    let mobile = false;
    let animate = true;
    try {
      mobile = matchMedia('(max-width:840px)').matches;
      animate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { animate = false; }
    if (veilStartedRef.current) return;   // 已由 PageVeil 接管整场转场
    // 库存 ↔ 展示（以管理为主的用户用顶栏切换进入）：不播整页左右滑动，顶栏留在原地，
    // 只让下方内容柔和淡入（切换控件的滑块自己滑过去）
    if (mobile && animate && !fromHistory && !showcaseTab
        && ((prev === 'gallery' && isShelf(page)) || (page === 'gallery' && isShelf(prev)))) {
      main.classList.add('page-in-fade');
      const t = window.setTimeout(() => main.classList.remove('page-in-fade'), 400);
      return () => { window.clearTimeout(t); main.classList.remove('page-in-fade'); };
    }
    if (!snap || !mobile || !animate || fromHistory) return;
    // 两页之间：顶栏留在原地，只有下面的内容换——旧页（含旧顶栏）快照先淡出，新页顶栏与内容稍后淡入，
    // 内容带一点顺着导航方向的位移；全程同位置叠放，没有整幅滑动，所以不会「整页切掉」。
    const dir: 1 | -1 = rankOf(page, showcaseTab) >= rankOf(prev, showcaseTab) ? 1 : -1;
    snap.el.classList.remove('page-in-soft', 'page-in-fade');
    snap.el.classList.add('page-out-soft');
    // 快照不随窗口滚动：按抓取时的滚动偏移还原，吸顶页头停在用户此刻看到的位置
    snap.el.querySelectorAll<HTMLElement>('.page-head').forEach(h => {
      h.style.transform = `translateY(${snap.y}px)`;
    });
    const ghost = document.createElement('div');
    ghost.className = 'page-ghost page-ghost-over page-ghost-soft';
    ghost.setAttribute('aria-hidden', 'true');
    const shifter = document.createElement('div');
    shifter.className = 'page-ghost-shift';
    shifter.style.transform = `translateY(${-snap.y}px)`;
    shifter.appendChild(snap.el);
    ghost.appendChild(shifter);
    document.body.appendChild(ghost);
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
    main.style.setProperty('--soft-dx', `${dir * 22}px`);
    main.classList.add('page-in-soft');
    document.documentElement.classList.add('page-anim-lock');
    let ghostGone = false;
    const dropGhost = () => {if (!ghostGone) {ghostGone = true; ghost.remove();}};
    const finish = () => {
      dropGhost();
      main.classList.remove('page-in-soft');
      main.style.removeProperty('--soft-dx');
      document.documentElement.classList.remove('page-anim-lock');
    };
    snap.el.addEventListener('animationend', dropGhost);
    const ghostTimer = window.setTimeout(dropGhost, 400);
    const timer = window.setTimeout(finish, 620); // 兜底：收不到 animationend（如中途关动画）时也收尾
    return () => {
      window.clearTimeout(timer); window.clearTimeout(ghostTimer);
      finish(); // 快速连切：立刻收掉上一场过渡
    };
  }, [page]);

  return {mainRef, veil, setVeil};
}
