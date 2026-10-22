import {useEffect, useRef} from 'react';
import type {RefObject} from 'react';
import {advanceGalleryRoaming, edgeEase, smootherstep} from '../core/gallery-motion';

const RAMP_UP = 1.2;      // 开始巡游：速度按 S 形曲线从 0 升到全速的时间（秒）
const RAMP_DOWN = .7;     // 关闭 / 被打断：从当前速度降到 0
const RAMP_TOUCH = .22;   // 手指按下：要快一点让位
const RESUME_AFTER_TOUCH = 1100, RESUME_AFTER_WHEEL = 1400;

/**
 * 原生滚动容器的自动巡游。状态是一条 0→1 的进度，速度 = 全速 × smootherstep(进度)：
 * 想动（开启、没被触碰、没有全屏看图）就升，不想动就降；开关、触碰、滚轮、方向键与回到页面都只是改「想不想动」，
 * 由曲线接管过渡，不会瞬间启停。窗口失焦、打开设置抽屉等不再打断。
 * advance 收到的是已乘上速度系数的时间增量。
 */
export function useGalleryRoaming(root: RefObject<HTMLElement | null>, enabled: boolean,
                                  advance: (seconds: number) => void) {
  const latest = useRef(advance); latest.current = advance;
  const wanted = useRef(enabled); wanted.current = enabled;
  const kick = useRef<() => void>(() => {});
  useEffect(() => {
    const area = root.current;
    if (!area) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const contacts = new Set<number>();
    let frame = 0, previous = 0, resumeAt = 0, progress = 0;
    const postpone = (ms: number) => {resumeAt = Math.max(resumeAt, performance.now() + ms);};
    const down = (event: PointerEvent) => {contacts.add(event.pointerId); postpone(RESUME_AFTER_TOUCH);};
    const up = (event: PointerEvent) => {if (contacts.delete(event.pointerId)) postpone(RESUME_AFTER_TOUCH);};
    const wheel = () => postpone(RESUME_AFTER_WHEEL);
    const key = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) postpone(RESUME_AFTER_WHEEL);
    };
    const visibility = () => {previous = 0; if (document.hidden) contacts.clear();};
    const tick = (at: number) => {
      frame = 0;
      const dt = previous ? Math.min(.064, Math.max(0, (at - previous) / 1000)) : 0;
      previous = at;
      if (media.matches) progress = 0;
      const allowed = wanted.current && !media.matches && !document.hidden && contacts.size === 0
        && at >= resumeAt && !document.getElementById('lightbox');
      const rate = allowed ? 1 / RAMP_UP : -1 / (contacts.size ? RAMP_TOUCH : RAMP_DOWN);
      progress = Math.max(0, Math.min(1, progress + rate * dt));
      if (progress > 0 && dt > 0) latest.current(dt * smootherstep(progress));
      // 想动、或者还没降到 0 就继续排帧；既不想动又已静止才停下
      if (wanted.current || progress > 0) frame = requestAnimationFrame(tick); else previous = 0;
    };
    kick.current = () => {if (!frame) {previous = 0; frame = requestAnimationFrame(tick);}};
    area.addEventListener('pointerdown', down, true);
    area.addEventListener('wheel', wheel, {passive: true});
    area.addEventListener('keydown', key);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    document.addEventListener('visibilitychange', visibility);
    if (wanted.current) kick.current();
    return () => {
      cancelAnimationFrame(frame); kick.current = () => {};
      area.removeEventListener('pointerdown', down, true);
      area.removeEventListener('wheel', wheel); area.removeEventListener('keydown', key);
      window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [root]);
  useEffect(() => {if (enabled) kick.current();}, [enabled]);
}

export interface GalleryScrollPosition {position: number; painted: number; direction: number}

/** Keep fractional travel even in browsers that round scrollTop to whole pixels. */
export function roamGalleryScroller(element: HTMLElement, state: GalleryScrollPosition,
                                     seconds: number, pixelsPerSecond: number, horizontal = false) {
  const actual = horizontal ? element.scrollLeft : element.scrollTop;
  if (Math.abs(actual - state.painted) > 1) state.position = actual;
  const maximum = horizontal ? element.scrollWidth - element.clientWidth : element.scrollHeight - element.clientHeight;
  const zone = Math.min(maximum / 2, pixelsPerSecond * 2.2);
  const speed = pixelsPerSecond * edgeEase(state.position, maximum, zone);
  const next = advanceGalleryRoaming(state.position, state.direction, seconds, speed, 0, maximum);
  state.position = next.position; state.direction = next.direction;
  if (horizontal) element.scrollLeft = next.position; else element.scrollTop = next.position;
  state.painted = horizontal ? element.scrollLeft : element.scrollTop;
}
