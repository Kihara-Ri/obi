// useSlidingThumb：「选中项下面/后面有一块会滑动的滑块」的通用逻辑——分段控件的滑块、标签页的下划线共用。
// 做三件事：
//   1. 测量选中项的 offsetLeft / offsetWidth，把滑块移过去（每次渲染、容器缩放、字体加载、窗口缩放后重算）；
//   2. 首次落位不滑入：先关过渡落定再恢复；
//   3. persistKey：页面切换会让控件整个卸载重挂，滑块位置因此丢失、看起来没有动画。给同一个控件
//      起个 persistKey，模块级记住上次位置，重挂后先落在旧位置、再滑到新位置——跨页面也有滑动。
// 滑块元素需绝对定位、自带 transition（统一用 tokens 里的 --slide-ms / --slide-ease）。
import {useCallback, useEffect, useLayoutEffect} from 'react';
import type {RefObject} from 'react';

const lastRect = new Map<string, {x: number; w: number}>();

export interface SlidingThumbOptions {
  /** 滑块元素选择器（在容器内查找） */
  thumb: string;
  /** 选中项选择器（在容器内查找；找不到则隐藏滑块） */
  active: string;
  /** 跨重挂记住位置的键；同一个控件在不同页面里用同一个键 */
  persistKey?: string;
}

export function useSlidingThumb(root: RefObject<HTMLElement | null>, {thumb: thumbSel, active: activeSel, persistKey}: SlidingThumbOptions) {
  const paint = useCallback(() => {
    const box = root.current;
    const thumb = box?.querySelector<HTMLElement>(thumbSel);
    if (!box || !thumb) return;
    const on = box.querySelector<HTMLElement>(activeSel);
    if (!on) { thumb.style.opacity = '0'; return; }
    if (!on.offsetWidth) return;          // 控件不可见（display:none，如手机上隐藏的页头那份）：不测量、不记位置
    const x = on.offsetLeft;
    const w = on.offsetWidth;
    const place = (px: number, pw: number) => {
      thumb.style.width = `${pw}px`;
      thumb.style.transform = `translateX(${px}px)`;
    };
    if (!thumb.dataset.placed) {
      const from = persistKey ? lastRect.get(persistKey) : undefined;
      thumb.style.transition = 'none';
      thumb.style.opacity = '1';
      place(from?.x ?? x, from?.w ?? w);
      void thumb.offsetWidth;            // 落定旧位置
      thumb.dataset.placed = '1';
      thumb.style.transition = '';
      if (from) place(x, w);              // 恢复过渡后再去新位置 → 播放滑动
    } else {
      thumb.style.opacity = '1';
      place(x, w);
    }
    if (persistKey) lastRect.set(persistKey, {x, w});
  }, [root, thumbSel, activeSel, persistKey]);

  // 每次渲染后重算（选中项变化）
  useLayoutEffect(paint);

  // 外部原因导致的尺寸变化：容器缩放、字体加载完成、窗口缩放
  useEffect(() => {
    const box = root.current;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(paint);
    if (box && ro) ro.observe(box);
    window.addEventListener('resize', paint);
    void document.fonts?.ready.then(paint);
    return () => { ro?.disconnect(); window.removeEventListener('resize', paint); };
  }, [root, paint]);
}
