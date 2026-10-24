// 手机「更多」子页的左缘右划返回：只有顶栏以下的内容跟手右移，顶栏与底栏不动（样式见 styles/pagetransition.css）。
// 系统自带的返回手势会把整屏当快照一起滑走，所以 iOS 上子页不压历史（core/nav.ts），手势全由这里接管；
// 起手判定、拦系统手势与返回阈值在 core/edge-swipe.ts，与抽屉共用。
import {useLayoutEffect} from 'react';
import {BACK_TARGET} from '../core/page-back';
import {navigate} from '../core/nav';
import {commitsBack, installEdgeSwipe} from '../core/edge-swipe';

export function useEdgeSwipeBack(page: string) {
  useLayoutEffect(() => {
    const back = BACK_TARGET[page];
    if (!back) return;
    const el = () => document.getElementById('main') as HTMLElement;   // 首屏加载完才有，用的时候再取
    let mobile = false;
    try { mobile = matchMedia('(max-width:840px)').matches; } catch { /* 无 matchMedia */ }
    if (!mobile) return;
    const set = (v: number) => el().style.setProperty('--swipe-dx', v + 'px');
    const peek = (p: string) => window.dispatchEvent(new CustomEvent('obi-peek', {detail: p}));
    const clear = () => { el()?.classList.remove('is-swiping', 'is-swipe-settle'); el()?.style.removeProperty('--swipe-dx'); peek(''); };
    const settle = (to: number, then?: () => void) => {
      el().classList.add('is-swipe-settle');
      set(to);
      window.setTimeout(() => {
        // 返回：内容留在屏外、垫底页保持可见，直到新页提交（下面 effect 的清理在绘制前执行），避免旧页回弹 / 新页淡入造成的闪
        if (then) { document.documentElement.dataset.swipeBack = '1'; then(); window.setTimeout(clear, 900); } else clear();
      }, 230);
    };
    const uninstall = installEdgeSwipe({
      canStart: () => !!el() && !el().classList.contains('is-swipe-settle')
        && !document.getElementById('panel') && !document.getElementById('lightbox'),
      begin: () => { el().classList.add('is-swiping'); peek(back.href.slice(1)); },
      move: set,
      end: (dx, v) => commitsBack(dx, v, innerWidth) ? settle(innerWidth, () => navigate(back.href)) : settle(0),
      cancel: () => settle(0),
    });
    return () => { uninstall(); clear(); };
  }, [page]);
}
