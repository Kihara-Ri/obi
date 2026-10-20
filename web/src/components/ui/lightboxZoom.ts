// 灯箱缩放：双指捏合（以两指中点为焦点）、放大后单指 / 鼠标平移、双击（双触）在 1× 与 2.5× 间切换，
// 桌面触控板捏合（ctrl+滚轮）同样生效。只改当前照片 img 的 transform，不碰轨道 / 翻页状态：
// 放大期间 Lightbox 不再把单指当翻页手势（见 Lightbox 的 onPointerDown），缩回 1× 后恢复。
// 全部走 ref，不触发 React 重渲染；关闭、翻页、卸载前必须调用 reset，否则收起动画会以放大后的矩形为起点。
import {useRef} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';

const MAX_SCALE = 5;
const DOUBLE_SCALE = 2.5;
const DOUBLE_MS = 300;
const TAP_SLOP = 10;

type Pt = {x: number; y: number};
export type ZoomDown = 'none' | 'pan' | 'pinch';

export function useLightboxZoom(getImg: () => HTMLImageElement | null) {
  const pts = useRef(new Map<number, Pt>());
  const view = useRef({scale: 1, tx: 0, ty: 0});
  const pinch = useRef<{dist: number; scale: number; mx: number; my: number; tx: number; ty: number} | null>(null);
  const pan = useRef<{x: number; y: number; tx: number; ty: number} | null>(null);
  const tap = useRef<{x: number; y: number; at: number; moved: boolean} | null>(null);
  const lastTap = useRef<{x: number; y: number; at: number} | null>(null);

  const paint = (animate: boolean) => {
    const img = getImg();
    if (!img) return;
    const {scale, tx, ty} = view.current;
    img.style.transition = animate ? 'transform .2s ease-out' : 'none';
    img.style.transform = scale === 1 && !tx && !ty ? '' : `translate(${tx}px,${ty}px) scale(${scale})`;
  };
  // 放大后图片超出视口的部分才允许平移；小于视口的方向锁在中心。
  const clamp = (scale: number, tx: number, ty: number) => {
    const img = getImg();
    const mx = img ? Math.max(0, (img.offsetWidth * scale - window.innerWidth) / 2) : 0;
    const my = img ? Math.max(0, (img.offsetHeight * scale - window.innerHeight) / 2) : 0;
    return {tx: Math.min(mx, Math.max(-mx, tx)), ty: Math.min(my, Math.max(-my, ty))};
  };
  const set = (scale: number, tx: number, ty: number, animate = false) => {
    const s = Math.min(MAX_SCALE, Math.max(1, scale));
    const t = s === 1 ? {tx: 0, ty: 0} : clamp(s, tx, ty);
    view.current = {scale: s, ...t};
    paint(animate);
  };
  // 以屏幕点 (px,py) 为不动点缩放到 next：t' = (p - c) - (next/prev)·(p - c - t)，c 为视口中心。
  const zoomAt = (next: number, px: number, py: number, animate = false) => {
    const {scale, tx, ty} = view.current;
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const k = next / scale;
    set(next, (px - cx) - k * (px - cx - tx), (py - cy) - k * (py - cy - ty), animate);
  };
  const reset = (animate = false) => {
    pts.current.clear(); pinch.current = null; pan.current = null; tap.current = null; lastTap.current = null;
    view.current = {scale: 1, tx: 0, ty: 0};
    if (animate) paint(true);
    else {const img = getImg(); if (img) {img.style.transition = ''; img.style.transform = '';}}
  };
  const pair = () => {
    const [a, b] = [...pts.current.values()];
    return {dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2};
  };

  const down = (e: ReactPointerEvent): ZoomDown => {
    pts.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pts.current.size === 2) {
      const p = pair();
      pinch.current = {...p, scale: view.current.scale, tx: view.current.tx, ty: view.current.ty};
      pan.current = null; tap.current = null;
      return 'pinch';
    }
    if (pts.current.size > 2) return 'pinch';
    tap.current = {x: e.clientX, y: e.clientY, at: e.timeStamp, moved: false};
    if (view.current.scale > 1) {
      pan.current = {x: e.clientX, y: e.clientY, tx: view.current.tx, ty: view.current.ty};
      return 'pan';
    }
    return 'none';
  };

  /** 返回 true 表示事件已被缩放 / 平移消费，Lightbox 不再走翻页逻辑。 */
  const move = (e: ReactPointerEvent): boolean => {
    if (!pts.current.has(e.pointerId)) return false;
    pts.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (tap.current && Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) > TAP_SLOP) tap.current.moved = true;
    const p = pinch.current;
    if (p && pts.current.size >= 2) {
      const now = pair();
      const next = Math.min(MAX_SCALE, Math.max(0.6, p.scale * now.dist / p.dist));
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      const k = next / p.scale;
      // 起始中点 → 当前中点：缩放跟随手指，同时带上两指整体平移
      const tx = (now.mx - cx) - k * (p.mx - cx - p.tx);
      const ty = (now.my - cy) - k * (p.my - cy - p.ty);
      const img = getImg();
      view.current = {scale: next, ...(next <= 1 ? {tx, ty} : clamp(next, tx, ty))};
      if (img) {
        img.style.transition = 'none';
        img.style.transform = `translate(${view.current.tx}px,${view.current.ty}px) scale(${next})`;
      }
      return true;
    }
    if (pan.current && pts.current.size === 1) {
      set(view.current.scale, pan.current.tx + e.clientX - pan.current.x, pan.current.ty + e.clientY - pan.current.y);
      return true;
    }
    return false;
  };

  /** 返回 true 表示这次抬起属于缩放 / 平移 / 双击，Lightbox 应丢弃翻页手势。 */
  const up = (e: ReactPointerEvent): boolean => {
    const known = pts.current.delete(e.pointerId);
    if (!known) return false;
    if (pinch.current) {
      if (pts.current.size < 2) {
        pinch.current = null;
        if (view.current.scale < 1.02) set(1, 0, 0, true); // 缩得比 1× 小：回弹到 1×
        else {
          set(view.current.scale, view.current.tx, view.current.ty, true);
          const rest = [...pts.current.values()][0];
          pan.current = rest ? {x: rest.x, y: rest.y, tx: view.current.tx, ty: view.current.ty} : null;
        }
      }
      return true;
    }
    const t = tap.current;
    tap.current = null;
    const wasPan = !!pan.current;
    pan.current = null;
    if (t && !t.moved && pts.current.size === 0) {
      const prev = lastTap.current;
      if (prev && e.timeStamp - prev.at < DOUBLE_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < TAP_SLOP * 3) {
        lastTap.current = null;
        if (view.current.scale > 1) set(1, 0, 0, true);
        else zoomAt(DOUBLE_SCALE, e.clientX, e.clientY, true);
        return true;
      }
      lastTap.current = {x: e.clientX, y: e.clientY, at: e.timeStamp};
    }
    return wasPan;
  };

  /** 触控板捏合 / ctrl+滚轮：缩放焦点为指针位置。 */
  const wheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return false;
    e.preventDefault();
    const next = Math.min(MAX_SCALE, Math.max(1, view.current.scale * Math.exp(-e.deltaY * 0.01)));
    zoomAt(next, e.clientX, e.clientY);
    return true;
  };

  return {down, move, up, wheel, reset, zoomed: () => view.current.scale > 1.01 || !!pinch.current};
}
