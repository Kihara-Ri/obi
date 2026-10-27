import {useEffect, useRef} from 'react';
import type {RefObject} from 'react';
import {advanceGalleryRoaming, edgeEase, galleryWallLoop, rampEase} from '../core/gallery-motion';

const RAMP_UP = .5;       // 开始巡游：速度按缓出曲线从 0 升到全速的时间（秒）——只是去掉硬起步，不做长加速
const RAMP_DOWN = .35;    // 关闭 / 被打断：从当前速度降到 0
const RAMP_TOUCH = .22;   // 手指按下：要快一点让位
const RESUME_AFTER_TOUCH = 1100, RESUME_AFTER_WHEEL = 1400;

/**
 * 原生滚动容器的自动巡游。状态是一条 0→1 的进度，速度 = 全速 × rampEase(进度)：
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
    let frame = 0, previous = 0, resumeAt = 0, progress = 0, moving = false;
    const postpone = (ms: number) => {resumeAt = Math.max(resumeAt, performance.now() + ms);};
    // 手指 / 滚轮一接管就清掉亚像素补偿，原生滚动从整像素位置接着走（误差不到 1px）
    const down = (event: PointerEvent) => {contacts.add(event.pointerId); postpone(RESUME_AFTER_TOUCH); clearGalleryScrollRests(area);};
    const up = (event: PointerEvent) => {if (contacts.delete(event.pointerId)) postpone(RESUME_AFTER_TOUCH);};
    const wheel = () => {postpone(RESUME_AFTER_WHEEL); clearGalleryScrollRests(area);};
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
      if (progress > 0 && dt > 0) latest.current(dt * rampEase(progress));
      else if (progress === 0 && moving) clearGalleryScrollRests(area);
      moving = progress > 0;
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
  state.painted = paintGalleryScroll(element, next.position, horizontal);
}

/** WebKit 把 scrollTop / scrollLeft 取成整像素：慢速巡游时画面停几帧再跳 1px，看起来一卡一卡。
 * 滚动只写整数，剩下不足 1px 的部分用滚动容器自身的 translate 补上（容器框挪动不到 1px 看不出，里面的内容连续亚像素移动）。
 * 返回实际滚动位置，供下一帧判断是否被手动滚过。 */
export function paintGalleryScroll(element: HTMLElement, position: number, horizontal = false): number {
  const whole = Math.floor(position);
  if (horizontal) element.scrollLeft = whole; else element.scrollTop = whole;
  const actual = horizontal ? element.scrollLeft : element.scrollTop;
  const rest = position - actual;
  if (rest > .001 && rest < 1) {
    const shift = `${-rest.toFixed(3)}px`;
    element.style.translate = horizontal ? `${shift} 0` : `0 ${shift}`;
    element.dataset.roamRest = '';
  } else clearGalleryScrollRest(element);
  return actual;
}

function clearGalleryScrollRest(element: HTMLElement) {
  if (!('roamRest' in element.dataset)) return;
  element.style.translate = ''; delete element.dataset.roamRest;
}

/** 巡游停下或被打断：清掉区域内（含区域自身）所有亚像素补偿。 */
export function clearGalleryScrollRests(area: HTMLElement) {
  clearGalleryScrollRest(area);
  area.querySelectorAll<HTMLElement>('[data-roam-rest]').forEach(clearGalleryScrollRest);
}

/** 网格（封面墙 / 桌面铺开）的循环周期：按 offsetTop 数出列数与行距，周期取整行（lcm），
 * copies = 需要铺几份；single = 只有一份时能滚到的最大距离。内容不够铺满一屏时返回 null（不循环）。 */
export function measureGalleryGridLoop(area: HTMLElement, items: ArrayLike<HTMLElement>, count: number) {
  const first = items[0];
  if (!first) return null;
  let cols = 0;
  while (cols < items.length && items[cols].offsetTop === first.offsetTop) cols++;
  const pitch = items[cols] ? items[cols].offsetTop - first.offsetTop : 0;
  const single = Math.ceil(count / cols) * pitch - (pitch - first.offsetHeight) - area.clientHeight;
  if (!pitch || single <= 1) return null;
  const {periodItems, copies} = galleryWallLoop(count, cols, area.clientHeight / pitch + 1);
  return {copies, period: periodItems / cols * pitch, single};
}
