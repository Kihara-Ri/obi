// 抽屉面板：遮罩、焦点圈、Esc 关闭、离开时还原焦点。
// 手机上是底部 sheet：进入自屏底滑入；按住头部（抓手/标题区）下拉，松手超过阈值
// 或快速下滑即收回，否则回弹。未保存关闭会先弹确认（脏标记由表单经 AppCtx.setDrawerDirty 设置）。
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {DrawerSpec} from '../../state/AppContext';
import {ChevLeftIco} from '../icons';

const SHEET_QUERY = '(max-width:840px)';
const TOUCH_QUERY = '(pointer:coarse), (max-width:840px)';
// prefers-reduced-motion 下动画被全局禁用、收不到 animationend，用定时器兜底（动画最长 .28s）
const CLOSE_FALLBACK_MS = 400;

// 抽屉内页面切换动效（用户 2026-10-20 选定并要求放慢、更明显）：下钻页「推入 + 视差」（横向），任务页「上升覆盖」（竖向，同 iOS 弹出编辑页）。
// 时长集中在这里，调快慢只改这一处。曲线沿用全站 --ease-out。
const EASE = 'cubic-bezier(.2,.8,.3,1)';
const MOTION = {push: 480, pop: 420, sheet: 520, unsheet: 480, fade: 120, parallax: 30, dim: 0.12,
  /** 上升覆盖：旧页退后的样子（缩小比例、上提 px、圆角 px、压暗） */
  recede: {scale: 0.94, lift: 6, radius: 16, dim: 0.16}};

export function Drawer({spec, closing, pages, pageKey = 0, direction = 'forward', onClose, onClosed}: {
  spec: DrawerSpec; closing: boolean;
  /** 每次内容切换（详情 → 编辑 / 二级页 / 返回）递增；抽屉首次挂载的那一页不播内容过渡（由抽屉自己的滑入负责） */
  pageKey?: number; direction?: 'forward' | 'back';
  /** 页面栈（栈底 → 栈顶）：每层都保持挂载，只有栈顶可见。返回 = 弹栈露出上一层，不重新创建，所以不会重新加载 */
  pages: DrawerSpec[];
  onClose: () => boolean;   // false = 脏表单的放弃确认被取消，抽屉保持打开
  onClosed: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const exitedRef = useRef(false);
  const dragRef = useRef<{startY: number; dy: number; v: number; lastY: number; lastT: number} | null>(null);
  const edgeActiveRef = useRef(false);
  const firstPage = useRef(pageKey);
  const pageClass = pageKey !== firstPage.current ? ' is-' + direction : '';
  const pagesRef = useRef<HTMLDivElement>(null);
  const prevDepth = useRef(pages.length);
  const prevTop = useRef<DrawerSpec>(spec);
  const specRef = useRef(spec);
  specRef.current = spec;

  const finishClose = () => {
    if (exitedRef.current) return;
    exitedRef.current = true;
    onClosed();
  };

  // 打开时：记住焦点、锁定背景、聚焦第一个输入
  useEffect(() => {
    const lastFocus = document.activeElement as HTMLElement | null;
    const shell = document.getElementById('shell');
    if (shell) shell.inert = true;
    const panel = panelRef.current;
    // 触屏 / 手机宽度：聚焦输入框会立刻唤起软键盘盖住表单，改为聚焦抽屉本身，用户点哪个字段才弹键盘
    const touch = window.matchMedia(TOUCH_QUERY).matches;
    const target = touch ? sheetRef.current
      : (spec.initialFocus === 'close' ? null
        : panel?.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea'))
      || panel?.querySelector<HTMLElement>('[data-action=close]')
      || panel?.querySelector<HTMLElement>('.drawer-head button');
    target?.focus();
    return () => {
      if (shell) shell.inert = false;
      if (lastFocus?.isConnected) lastFocus.focus();
    };
  }, [spec]);

  // 收回动画兜底：reduced-motion 下 animationend 永远不来
  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(finishClose, CLOSE_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [closing]);

  // iOS 软键盘：WebKit 会把可视视口在布局视口内下移（visualViewport.offsetTop>0），
  // fixed 面板在屏幕上被整体顶出上缘。把 #panel 整层平移 offsetTop（背板随行，可视
  // 区域永远被盖住），sheet 在屏幕上保持原位、布局零变化——键盘只是叠在其下半部
  // 之上的一层（见下 --kb：现在改为把 sheet 抬到键盘上沿，避免键盘盖住输入框）。键盘收起
  // （offsetTop 归零）即还原。只在手机 sheet 断点生效：桌面捏合缩放也会动 offsetTop，
  // 不该拖着抽屉跑。
  // 同期锁定文档滚动（横竖都钉）：sheet 盖不住系统级滚动指示器；聚焦输入还会让
  // WebKit 滚动文档「露出」输入框，背景一动 Safari 底部地址栏就会重新展开盖住底部。
  // html overflow:hidden 挡不住 iOS 的这脚程序滚动，需把 scrollY 钉在开抽屉时的值。
  useEffect(() => {
    const vv = window.visualViewport;
    const panel = panelRef.current;
    if (!panel || !window.matchMedia(SHEET_QUERY).matches) return;
    const html = document.documentElement;
    html.style.overflow = 'hidden';
    const lockX = window.scrollX;
    const lockY = window.scrollY;
    const onScroll = () => {
      if (window.scrollX !== lockX || window.scrollY !== lockY) window.scrollTo(lockX, lockY);
    };
    window.addEventListener('scroll', onScroll, {passive: true});
    if (!vv) {
      return () => {
        window.removeEventListener('scroll', onScroll);
        html.style.overflow = '';
      };
    }
    // 键盘占位：布局视口不变、可视视口缩小，差值 = 键盘高度。把 sheet 底边抬到键盘上沿（--kb），
    // sheet 随之变矮，drawer-body 在可见区内滚动；再把当前输入框滚到可见区中间，否则会被键盘盖住。
    // 捏合缩放时 vv.height 也会变小，scale>1 不算键盘。
    const KEYBOARD_MIN = 80;
    const reveal = () => {
      const el = document.activeElement;
      const body = panel.querySelector<HTMLElement>('.drawer-body');
      if (!body || !(el instanceof HTMLElement) || !panel.contains(el)
        || !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      const box = el.getBoundingClientRect();
      const frame = body.getBoundingClientRect();
      body.scrollTop += box.top + box.height / 2 - (frame.top + frame.height / 2);
    };
    let lastKb = 0;
    const apply = () => {
      panel.style.transform = vv.offsetTop > 1 ? `translateY(${vv.offsetTop}px)` : '';
      const raw = vv.scale > 1.01 ? 0 : Math.round(window.innerHeight - vv.height);
      const kb = raw > KEYBOARD_MIN ? raw : 0;
      panel.style.setProperty('--kb', kb + 'px');
      if (kb && kb !== lastKb) requestAnimationFrame(reveal);
      lastKb = kb;
    };
    const onFocusIn = () => { if (lastKb) window.setTimeout(reveal, 60); };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    panel.addEventListener('focusin', onFocusIn);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      panel.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('scroll', onScroll);
      panel.style.transform = '';
      panel.style.removeProperty('--kb');
      html.style.overflow = '';
    };
  }, [spec]);

  // —— 手机 sheet：屏幕左缘横向右滑 = 跟手下拉收起 ——
  // iOS 系统对边缘右滑的默认响应是整页侧向过渡（浏览器自己的返回动画），对上拉
  // sheet 毫无意义且收尾会闪。页面在 touchmove 上 preventDefault 可令该系统手势
  // 中止（触摸流仍完整送达页面），于是把这段手势接管成「按住 sheet 往下拖」：
  // 横向位移 1:1 映射为下拉位移，松手超过阈值或快速下滑即收回，否则回弹；纵向
  // 滑动不拦截，放行给 drawer-body 原生滚动。桌面断点不接管。
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    let start: {x: number; y: number} | null = null;
    let active = false;
    let dx = 0, v = 0, lastX = 0, lastT = 0;
    // 二级页（有返回目标）上，左缘右滑 = 返回上一页（带动画），而不是把整个抽屉下拉关闭
    let secondary = false;
    const springBack = () => {
      sheet.style.transition = 'transform .26s cubic-bezier(.2,.8,.3,1)';
      sheet.style.transform = '';
    };
    const onStart = (e: TouchEvent) => {
      if (closing || dragRef.current || edgeActiveRef.current) return;
      if (!window.matchMedia(SHEET_QUERY).matches) return;
      const t = e.touches[0];
      if (t.clientX > 28) return;
      // 手起点落在 sheet 内部横向滚动条带上（如封面候选）时让位给原生横向滚动
      let node: Element | null = e.target instanceof Element ? e.target : null;
      while (node && node !== sheet) {
        if (node.scrollWidth > node.clientWidth + 1) return;
        node = node.parentElement;
      }
      // 键盘弹出时 WebKit 会把横向手势整流收归系统（页面收不到 touchmove），
      // 先同步收起键盘：键盘落下后触摸流回到页面，本次滑动继续作为下拉接管
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) focused.blur();
      start = {x: t.clientX, y: t.clientY};
      secondary = !!specRef.current.back;
      active = false; dx = 0; v = 0; lastX = t.clientX; lastT = e.timeStamp;
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      if (e.touches.length > 1) {  // 捏合等多指手势不接管
        start = null;
        if (active) { active = false; edgeActiveRef.current = false; springBack(); }
        return;
      }
      const t = e.touches[0];
      const ddx = t.clientX - start.x;
      const ddy = t.clientY - start.y;
      if (!active) {
        if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
        if (ddx <= 0 || Math.abs(ddx) <= Math.abs(ddy)) { start = null; return; }
        active = true;
        edgeActiveRef.current = true;
        if (!secondary) sheet.style.transition = 'none';
      }
      e.preventDefault();  // 中止系统边缘侧滑与页面滚动，本次触摸交给 sheet 拖拽
      dx = Math.max(0, ddx);
      const dt = e.timeStamp - lastT;
      if (dt > 0) { v = (t.clientX - lastX) / dt; lastX = t.clientX; lastT = e.timeStamp; }
      if (!secondary) sheet.style.transform = `translateY(${dx}px)`;
    };
    const onEnd = () => {
      if (!start) return;
      start = null;
      if (!active) return;
      active = false;
      edgeActiveRef.current = false;
      if (secondary) {
        // 位移够长或快速甩动才算返回；不跟手，松手后由页面切换动画接管
        if (dx > 70 || (dx > 30 && v > 0.45)) specRef.current.back?.run();
        return;
      }
      const fling = dx > 40 && v > 0.55;
      const far = dx > Math.max(110, sheet.offsetHeight * 0.22);
      if ((fling || far) && onClose()) {
        // closing 类接管：隐式动画起点 = 当前内联位移，继续滑向屏底
      } else {
        springBack();
      }
    };
    // touchstart 必须 capture：iOS 键盘弹出时 WebKit 只把 touchstart 派发到捕获阶段
    // （冒泡阶段收不到，实测），而收键盘、记录手势起点都依赖它。
    document.addEventListener('touchstart', onStart, {passive: true, capture: true});
    document.addEventListener('touchmove', onMove, {passive: false});
    document.addEventListener('touchend', onEnd, {passive: true});
    document.addEventListener('touchcancel', onEnd, {passive: true});
    return () => {
      document.removeEventListener('touchstart', onStart, true);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [closing, onClose, spec]);

  // —— 手机 sheet：竖向手势不许「漏」给文档 ——
  // 内容不够长（如记录售出，键盘弹出时更是）时 drawer-body 无可滚动，iOS 会把竖向滑动改成滚动
  // 文档 / 平移可视视口：visualViewport.offsetTop 随之变化，上面的 translateY 与 scrollTo 钉位互相
  // 拉扯，整个 sheet 抽搐。这里对「起点在抽屉内、最近的可滚动祖先不存在或已到边」的竖向 touchmove
  // 直接 preventDefault；可滚动内容未到边时放行原生滚动，横向手势（封面候选条等）不拦。
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !window.matchMedia(SHEET_QUERY).matches) return;
    let lastX = 0, lastY = 0;
    const scroller = (from: EventTarget | null): HTMLElement | null => {
      for (let n = from instanceof Element ? from : null; n && n !== panel; n = n.parentElement) {
        if (!(n instanceof HTMLElement)) continue;
        const oy = getComputedStyle(n).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
      }
      return null;
    };
    const onStart = (e: TouchEvent) => { lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length > 1 || !e.cancelable || !(e.target instanceof Node) || !panel.contains(e.target)) return;
      const t = e.touches[0];
      const dx = t.clientX - lastX, dy = t.clientY - lastY;
      lastX = t.clientX; lastY = t.clientY;
      if (Math.abs(dx) >= Math.abs(dy)) return;
      const sc = scroller(e.target);
      const atTop = !sc || sc.scrollTop <= 0;
      const atBottom = !sc || sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
      if ((dy > 0 && atTop) || (dy < 0 && atBottom)) e.preventDefault();
    };
    panel.addEventListener('touchstart', onStart, {passive: true, capture: true});
    panel.addEventListener('touchmove', onMove, {passive: false});
    return () => {
      panel.removeEventListener('touchstart', onStart, true);
      panel.removeEventListener('touchmove', onMove);
    };
  }, [spec]);

  // —— 页面切换动画（WAAPI，只动 transform / opacity）——
  // 栈里每一层是一个常驻的 .drawer-page 节点；进入 / 返回只是改变谁是栈顶，动画直接作用在这些真实节点上：
  // 前进到有返回目标的页面 = 下钻：新页整幅从右推入盖住旧页，旧页同时左退 30% 并压暗（视差）；
  // 返回 = 反向：离场页整幅滑出，露出下面的上一页（从 -30% 回位、压暗退去）；
  // 其余（编辑、记录售出等任务页）= 上升覆盖：新页整幅从底部升起盖住旧页，旧页缩小到 94%、压暗、四角变圆；
  // 取消 / 返回时离场页整幅落下，旧页回弹复位。竖向 = 去办一件事，横向 = 往里看。
  // 抽屉首次打开的页面由抽屉自己的滑入负责；减少动态效果时一律 0.12s 淡入淡出。
  // 离场页在动画期间仍是栈外的一个「幽灵层」（leaving），动画结束后卸载。
  useLayoutEffect(() => {
    const host = pagesRef.current;
    const prevSpec = prevTop.current, depth = pages.length, before = prevDepth.current;
    prevTop.current = spec; prevDepth.current = depth;
    if (!host || pageKey === firstPage.current) return;
    const nodes = Array.from(host.querySelectorAll<HTMLElement>(':scope > .drawer-page'));
    const top = nodes[nodes.length - 1];
    if (!top) return;
    const fwd = depth > before || (depth === before && direction === 'forward');
    // 前进时「旧页」是栈里倒数第二层；返回时「旧页」是刚弹出的页面（作为 leaving 幽灵层保留在 DOM 里）
    const other = fwd ? nodes[nodes.length - 2] : host.querySelector<HTMLElement>(':scope > .drawer-page.is-leaving');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const drill = fwd ? !!spec.back : !!prevSpec.back;
    const kind: 'push' | 'pop' | 'sheet' | 'unsheet' = fwd ? (drill ? 'push' : 'sheet') : (drill ? 'pop' : 'unsheet');
    const receded = {transform: `scale(${MOTION.recede.scale}) translateY(-${MOTION.recede.lift}px)`, borderRadius: `${MOTION.recede.radius}px`};
    const resting = {transform: 'none', borderRadius: '0px'};
    const anims: Animation[] = [];
    const extras: HTMLElement[] = [];
    const play = (node: Element, frames: Keyframe[], ms: number) =>
      anims.push(node.animate(frames, {duration: ms, easing: EASE, fill: 'both'}));
    const dim = (hostEl: HTMLElement, from: number, to: number, ms: number) => {
      const d = document.createElement('div'); d.className = 'drawer-dim'; hostEl.appendChild(d); extras.push(d);
      play(d, [{opacity: from}, {opacity: to}], ms);
    };
    // 栈里不是栈顶的层要保持可见到动画结束（它们是被盖住的下层）
    const under = fwd ? other : top;
    under?.classList.add('is-animating');
    if (reduced) {
      if (other) play(fwd ? other : other, [{opacity: 1}, {opacity: 0}], MOTION.fade);
      play(top, [{opacity: 0}, {opacity: 1}], MOTION.fade);
    } else if (kind === 'push') {
      top.classList.add('edge'); top.style.zIndex = '3';
      play(top, [{transform: 'translateX(100%)'}, {transform: 'none'}], MOTION.push);
      if (other) { play(other, [{transform: 'none'}, {transform: `translateX(-${MOTION.parallax}%)`}], MOTION.push); dim(other, 0, MOTION.dim, MOTION.push); }
    } else if (kind === 'pop') {
      top.style.zIndex = '1';
      play(top, [{transform: `translateX(-${MOTION.parallax}%)`}, {transform: 'none'}], MOTION.pop);
      dim(top, MOTION.dim, 0, MOTION.pop);
      if (other) { other.classList.add('edge'); other.style.zIndex = '3'; play(other, [{transform: 'none'}, {transform: 'translateX(100%)'}], MOTION.pop); }
    } else if (kind === 'unsheet') {
      top.style.zIndex = '1';
      play(top, [receded, resting], MOTION.unsheet);
      dim(top, MOTION.recede.dim, 0, MOTION.unsheet);
      if (other) { other.classList.add('edge-top'); other.style.zIndex = '3'; play(other, [{transform: 'none'}, {transform: 'translateY(100%)'}], MOTION.unsheet); }
    } else {
      top.classList.add('edge-top'); top.style.zIndex = '3';
      play(top, [{transform: 'translateY(100%)'}, {transform: 'none'}], MOTION.sheet);
      if (other) { play(other, [resting, receded], MOTION.sheet); dim(other, 0, MOTION.recede.dim, MOTION.sheet); }
    }
    let live = true;
    const cleanup = () => {
      if (!live) return;
      live = false;
      anims.forEach(a => a.cancel());
      extras.forEach(n => n.remove());
      [top, other].forEach(n => { if (n) { n.classList.remove('edge', 'edge-top', 'is-animating'); n.style.zIndex = ''; } });
      setLeaving(null);
    };
    void Promise.all(anims.map(a => a.finished)).then(cleanup, cleanup);
    return cleanup;
  }, [pageKey]);

  // —— 页面栈 → 稳定的层 id ——
  // 栈里的每个 spec 对象分配一个稳定 id，React 以此作 key：同一个 spec 在栈里一直是同一个 DOM 节点，
  // 所以进入二级页再返回时，下面那层不会被销毁重建。
  const idOf = useRef(new WeakMap<DrawerSpec, number>());
  const nextId = useRef(1);
  const idFor = (sp: DrawerSpec) => {
    let id = idOf.current.get(sp);
    if (!id) { id = nextId.current++; idOf.current.set(sp, id); }
    return id;
  };
  const layers = (pages.length ? pages : [spec]).map(sp => ({id: idFor(sp), spec: sp}));
  // 返回：栈变浅时，被弹出的那层作为 leaving 保留到动画结束
  const [leaving, setLeaving] = useState<{id: number; spec: DrawerSpec} | null>(null);
  const lastLayers = useRef(layers);
  // 在渲染阶段（同一次提交内）检测「栈变浅」：被弹出的层立刻作为 leaving 挂上，动画 effect 才能拿到它的真实节点
  if (layers.length < lastLayers.current.length && !closing) {
    const gone = lastLayers.current.find(l => !layers.some(n => n.id === l.id));
    if (gone && leaving?.id !== gone.id) setLeaving(gone);
  }
  if (layers.length !== lastLayers.current.length || layers[layers.length - 1]?.id !== lastLayers.current[lastLayers.current.length - 1]?.id) {
    lastLayers.current = layers;
  }
  const renderPage = (sp: DrawerSpec) => <>
    {sp.asForm ? sp.content : <div className="drawer-body">{sp.content}</div>}
    {!sp.asForm && (sp.footer || sp.variant === 'artist')
      ? <div className={`drawer-footer${sp.variant === 'artist' ? ' artist-footer' : ''}`}>{sp.footer}</div> : null}
  </>;

  const requestClose = () => { if (!closing) onClose(); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); requestClose(); return; }
    if (e.key === 'Tab') {
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select,textarea,a[href]',
      )].filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  };

  // 收回动画结束（手机 sheet-down / 桌面 drawer-out）才真正卸载
  const onAnimationEnd = (e: React.AnimationEvent) => {
    if (closing && (e.animationName === 'sheet-down' || e.animationName === 'drawer-out')) finishClose();
  };

  // —— 手机 sheet：按住头部跟手下拉 ——
  const onHeadPointerDown = (e: React.PointerEvent) => {
    if (closing || dragRef.current || edgeActiveRef.current || !window.matchMedia(SHEET_QUERY).matches) return;
    if (e.target instanceof Element && e.target.closest('button')) return;
    if (!sheetRef.current) return;
    dragRef.current = {startY: e.clientY, dy: 0, v: 0, lastY: e.clientY, lastT: e.timeStamp};
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 合成事件无活动指针，忽略 */ }
  };

  const onHeadPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const sheet = sheetRef.current;
    if (!d || !sheet) return;
    d.dy = Math.max(0, e.clientY - d.startY);
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) { d.v = (e.clientY - d.lastY) / dt; d.lastY = e.clientY; d.lastT = e.timeStamp; }
    sheet.style.transition = 'none';
    sheet.style.transform = `translateY(${d.dy}px)`;
  };

  const endHeadDrag = () => {
    const d = dragRef.current;
    const sheet = sheetRef.current;
    dragRef.current = null;
    if (!d || !sheet) return;
    const fling = d.dy > 40 && d.v > 0.55;
    const far = d.dy > Math.max(110, sheet.offsetHeight * 0.22);
    if ((fling || far) && onClose()) {
      // closing 类接管：隐式动画起点 = 当前内联位移，继续滑向屏底
    } else {
      sheet.style.transition = 'transform .26s cubic-bezier(.2,.8,.3,1)';
      sheet.style.transform = '';
    }
  };

  return (
    <div id="panel" ref={panelRef} onKeyDown={onKeyDown}
         onClick={e => { if (e.target === e.currentTarget) requestClose(); }}>
      <section ref={sheetRef} onAnimationEnd={onAnimationEnd}
               className={`drawer${spec.wide ? ' wide' : ''}${spec.compact ? ' compact' : ''}${spec.workspace ? ' import-workspace' : ''}${closing ? ' closing' : ''}`}
               role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabIndex={-1}>
        <div className="drawer-head" onPointerDown={onHeadPointerDown} onPointerMove={onHeadPointerMove}
             onPointerUp={endHeadDrag} onPointerCancel={endHeadDrag}>
          {spec.back ? <button type="button" className="quiet drawer-back" aria-label={spec.back.label} title={spec.back.label}
            onClick={spec.back.run}>{ChevLeftIco}</button> : null}
          <h2 id="drawer-title" key={pageKey} className={pageClass.trim()}>{spec.title}</h2>
          <button type="button" className="quiet" data-action="close" onClick={requestClose} aria-label="关闭">×</button>
        </div>
        {/* 页面容器按 pageKey 重挂载；切换动画见上面的 useLayoutEffect，旧页快照作为 ghost 同容器内离场 */}
        <div className="drawer-pages" ref={pagesRef}>
          {/* 离场层：返回时刚被弹出的页面，保留到动画结束再卸载（它仍是同一个组件树，不是快照） */}
          {leaving ? <div className="drawer-page is-leaving" key={'leaving-' + leaving.id} aria-hidden="true" {...{inert: true}}>
            {renderPage(leaving.spec)}
          </div> : null}
          {layers.map((layer, i) => {
            const isTop = i === layers.length - 1;
            return <div className={`drawer-page${isTop ? '' : ' is-covered'}`} key={layer.id}
              aria-hidden={isTop ? undefined : true} {...(isTop ? {} : {inert: true})}>
              {renderPage(layer.spec)}
            </div>;
          })}
        </div>
      </section>
    </div>
  );
}
