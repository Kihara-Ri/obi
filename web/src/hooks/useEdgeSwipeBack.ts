// 手机「更多」子页的左缘右划返回：只有顶栏以下的内容跟手右移，顶栏与底栏不动（样式见 styles/pagetransition.css）。
// 系统自带的返回手势会把整屏当快照一起滑走，所以 iOS 上子页不压历史（core/nav.ts），手势全由这里接管。
import {useEffect} from 'react';
import {BACK_TARGET} from '../core/page-back';
import {navigate} from '../core/nav';

const EDGE = 28, COMMIT = .33, FLICK = .5;   // 起点距左缘 px；拖过屏宽的比例 / 速度（px/ms）即返回

export function useEdgeSwipeBack(page: string) {
  useEffect(() => {
    const back = BACK_TARGET[page];
    if (!back) return;
    const el = () => document.getElementById('main') as HTMLElement;   // 首屏加载完才有，用的时候再取
    let mobile = false;
    try { mobile = matchMedia('(max-width:840px)').matches; } catch { /* 无 matchMedia */ }
    if (!mobile) return;
    let x0 = 0, y0 = 0, t0 = 0, dx = 0, mode: '' | 'wait' | 'drag' = '';
    const set = (v: number) => el().style.setProperty('--swipe-dx', v + 'px');
    const end = (to: number, then?: () => void) => {
      el().classList.add('is-swipe-settle');
      set(to);
      window.setTimeout(() => {
        el().classList.remove('is-swiping', 'is-swipe-settle');
        el().style.removeProperty('--swipe-dx');
        then?.();
      }, 230);
    };
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!el() || e.touches.length !== 1 || t.clientX > EDGE || el()?.classList.contains('is-swipe-settle')
          || document.getElementById('panel') || document.getElementById('lightbox')) { mode = ''; return; }
      x0 = t.clientX; y0 = t.clientY; t0 = e.timeStamp; dx = 0; mode = 'wait';
    };
    const move = (e: TouchEvent) => {
      if (!mode) return;
      const t = e.touches[0];
      dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (mode === 'wait') {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (dx <= 0 || Math.abs(dy) > Math.abs(dx)) { mode = ''; return; }
        mode = 'drag';
        el().classList.add('is-swiping');
      }
      if (e.cancelable) e.preventDefault();
      set(Math.max(0, dx));
    };
    const finish = (e: TouchEvent) => {
      if (mode !== 'drag') { mode = ''; return; }
      mode = '';
      const fast = dx / Math.max(1, e.timeStamp - t0) > FLICK;
      if (dx > innerWidth * COMMIT || fast) end(innerWidth, () => navigate(back.href));
      else end(0);
    };
    const cancel = () => { if (mode === 'drag') end(0); mode = ''; };
    document.addEventListener('touchstart', start, {passive: true});
    document.addEventListener('touchmove', move, {passive: false});
    document.addEventListener('touchend', finish, {passive: true});
    document.addEventListener('touchcancel', cancel, {passive: true});
    return () => {
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', finish);
      document.removeEventListener('touchcancel', cancel);
      el()?.classList.remove('is-swiping', 'is-swipe-settle');
      el()?.style.removeProperty('--swipe-dx');
    };
  }, [page]);
}
