import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {MouseEvent, PointerEvent} from 'react';
import {advanceGalleryCarousel, advanceGalleryMotion, advanceGalleryRoaming, clampGalleryPosition, galleryReleaseVelocity, rampEase, releaseGalleryMotion, wrapGalleryPosition} from '../core/gallery-motion';
import type {GalleryMotionState, GalleryPoint} from '../core/gallery-motion';

/** 点开巡游后中心布局第一次翻页的等待（秒）。 */
const FIRST_TURN_DELAY = .6;

export interface GalleryMotionOptions {
  position: number;
  min: number;
  max: number;
  onFrame(position: number): void;
  onCommit(position: number): void;
  project(start: GalleryPoint, current: GalleryPoint, startPosition: number, anchor: HTMLElement | null): number;
  snap: boolean;
  enabled?: boolean;
  scopeKey?: string;
  onDragStart?(): void;
  onDragEnd?(): void;
  /** Circular rails keep an unbounded local position; only the saved anchor wraps. */
  loopCount?: number;
  autoRun?: boolean;
  autoVelocity?(): number;
  /** Center layouts dwell, then turn one album with the normal spring. */
  autoInterval?(): number;
  /** Bounded center rails reverse on their existing path at either end. */
  autoBounce?: boolean;
  releaseVelocityLimit?: number;
}

interface Gesture {
  id: number;
  start: GalleryPoint;
  position: number;
  anchor: HTMLElement | null;
  element: HTMLDivElement;
  moved: boolean;
  samples: Array<{position: number; at: number}>;
}

// 只有全屏看图会让出舞台；设置抽屉、速度滚轮等不打断自动运动（调速度时能一边看效果）。
const hasGalleryOverlay = () => !!document.getElementById('lightbox');

/** One continuous rail position. React and saved preferences only see committed anchors. */
export function useGalleryMotion(options: GalleryMotionOptions) {
  const latest = useRef(options);
  latest.current = options;
  const positionRef = useRef(clampGalleryPosition(options.position, options.min, options.max));
  const draggingRef = useRef(false);
  const gesture = useRef<Gesture | null>(null);
  const motion = useRef<GalleryMotionState | null>(null);
  const stepTarget = useRef<number | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<number | null>(null);
  const frame = useRef(0);
  const previousAt = useRef(0);
  const trailingClick = useRef(false);
  const lastCommitted = useRef(options.position);
  const lastExternal = useRef(options.position);
  const lastScope = useRef(options.scopeKey);
  const reduced = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const tickRef = useRef<(at: number) => void>(() => {});
  const resumeAt = useRef(0);
  const autoRamp = useRef(0);
  const lastAutoVelocity = useRef(0);
  const wasAutoRunning = useRef(false);
  const autoDirection = useRef(1);
  const carousel = useRef({elapsed: 0, direction: 1});
  const autoTransition = useRef(false);
  const pressedPointers = useRef(new Set<number>());
  const blurred = useRef(false);
  const bounds = () => latest.current.loopCount
    ? {min: -Infinity, max: Infinity} : {min: latest.current.min, max: latest.current.max};

  const commit = useCallback(() => {
    lastCommitted.current = latest.current.loopCount
      ? wrapGalleryPosition(Math.round(positionRef.current), latest.current.loopCount) : positionRef.current;
    latest.current.onCommit(positionRef.current);
  }, []);
  const releaseCapture = useCallback((active: Gesture) => {
    try {
      if (active.element.hasPointerCapture(active.id)) active.element.releasePointerCapture(active.id);
    } catch { /* The browser can have canceled this pointer already. */ }
  }, []);
  const clearStepTarget = useCallback(() => {
    if (stepTarget.current === null) return;
    stepTarget.current = null;
    setNavigationTarget(null);
  }, []);
  const canAutoRun = useCallback(() => latest.current.autoRun && latest.current.enabled !== false &&
    !reduced.current && !document.hidden && !blurred.current && !gesture.current && !pressedPointers.current.size &&
    !hasGalleryOverlay(), []);
  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(at => tickRef.current(at));
  }, []);
  const resetAutoClock = useCallback(() => {
    const current = latest.current;
    const {min, max} = bounds();
    carousel.current = advanceGalleryCarousel(carousel.current, 0, positionRef.current,
      current.autoInterval?.() ?? 4, min, max, true).clock;
    resumeAt.current = current.autoInterval ? 0 : performance.now() + 2800;
  }, []);
  const stop = useCallback((save = true) => {
    autoRamp.current = 0; lastAutoVelocity.current = 0;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    motion.current = null;
    autoTransition.current = false;
    resetAutoClock();
    clearStepTarget();
    previousAt.current = 0;
    const active = gesture.current;
    gesture.current = null;
    draggingRef.current = false;
    if (active) {
      releaseCapture(active);
      if (active.moved) latest.current.onDragEnd?.();
    }
    latest.current.onFrame(positionRef.current);
    if (save) commit();
    // Geometry changes and temporary interruptions retain the enabled switch.
    if (canAutoRun()) schedule();
  }, [canAutoRun, clearStepTarget, commit, releaseCapture, resetAutoClock, schedule]);

  tickRef.current = at => {
    frame.current = 0;
    if (document.hidden || blurred.current || hasGalleryOverlay()) {
      stop(); return;
    }
    const state = motion.current;
    if (autoTransition.current && !canAutoRun()) {stop(); return;}
    const seconds = previousAt.current ? Math.min(64, Math.max(0, at - previousAt.current)) / 1000 : 0;
    previousAt.current = at;
    if (state) {
      const {min, max} = bounds();
      motion.current = advanceGalleryMotion(state, seconds, min, max, latest.current.snap);
      positionRef.current = motion.current.position;
    } else if (canAutoRun() && at >= resumeAt.current) {
      if (latest.current.autoInterval) {
        // 循环轨道（loopCount）上没有两端，停留后一直朝同一方向翻
        const {min, max} = bounds();
        const center = clampGalleryPosition(Math.round(positionRef.current), min, max);
        let destination: number | null = center !== positionRef.current ? center : null;
        if (destination === null) {
          const next = advanceGalleryCarousel(carousel.current, seconds, positionRef.current,
            latest.current.autoInterval(), min, max);
          carousel.current = next.clock;
          destination = next.destination;
        }
        if (destination !== null) {
          motion.current = {position: positionRef.current, velocity: 0, phase: 'settle', target: destination};
          autoTransition.current = true;
        }
      } else {
        // 自动匀速运动起步：0.5 秒缓出到设定速度（任何一次中断后重新出发都会重新起步）
        autoRamp.current = Math.min(1, autoRamp.current + seconds / .5);
        const velocity = (latest.current.autoVelocity?.() || 0) * rampEase(autoRamp.current);
        lastAutoVelocity.current = velocity;
        if (latest.current.autoBounce) {
          const next = advanceGalleryRoaming(positionRef.current, autoDirection.current, seconds, velocity,
            latest.current.min, latest.current.max);
          positionRef.current = next.position;
          autoDirection.current = next.direction;
        } else if (Number.isFinite(velocity)) positionRef.current += velocity * seconds;
      }
    }
    latest.current.onFrame(positionRef.current);
    if (motion.current?.phase !== 'idle' && motion.current) schedule();
    else if (motion.current) {
      motion.current = null;
      autoTransition.current = false;
      if (latest.current.autoInterval) resetAutoClock();
      clearStepTarget(); commit();
    }
    if (canAutoRun()) schedule();
    else if (!motion.current) previousAt.current = 0;
  };

  const moveTo = useCallback((position: number, animate = true) => {
    stop(false);
    trailingClick.current = false;
    const {min, max} = bounds();
    const target = clampGalleryPosition(position, min, max);
    if (!animate || reduced.current || target === positionRef.current) {
      positionRef.current = target;
      latest.current.onFrame(target);
      commit();
      if (latest.current.autoRun && !reduced.current) schedule();
      return;
    }
    motion.current = {position: positionRef.current, velocity: 0, phase: 'settle', target};
    previousAt.current = performance.now();
    schedule();
  }, [commit, schedule, stop]);

  /** Repeated steps extend the destination immediately; reversing starts from
   * the visible position. No intermediate destinations are queued. */
  const step = useCallback((by: number) => {
    const pending = stepTarget.current;
    const continuing = pending !== null && Math.sign(pending - positionRef.current) === Math.sign(by);
    const base = continuing ? pending : Math.round(positionRef.current);
    const velocity = continuing && Math.sign(motion.current?.velocity || 0) === Math.sign(by)
      ? motion.current?.velocity || 0 : 0;
    const {min, max} = bounds();
    const target = clampGalleryPosition(base + by, min, max);
    moveTo(target);
    if (motion.current?.phase === 'settle') {
      motion.current.velocity = velocity;
      stepTarget.current = target;
      setNavigationTarget(target);
    }
    return target;
  }, [moveTo]);

  // An onCommit rounded anchor echo must not erase a free, fractional rail position.
  useLayoutEffect(() => {
    const scopeChanged = lastScope.current !== options.scopeKey;
    const externalChanged = lastExternal.current !== options.position;
    lastScope.current = options.scopeKey;
    lastExternal.current = options.position;
    if (scopeChanged || options.enabled === false || (externalChanged &&
        options.position !== Math.round(lastCommitted.current) && options.position !== lastCommitted.current)) {
      stop(false);
      trailingClick.current = false;
      positionRef.current = clampGalleryPosition(options.position, options.min, options.max);
      lastCommitted.current = options.position;
      if (scopeChanged) {autoDirection.current = 1; carousel.current.direction = 1;}
      latest.current.onFrame(positionRef.current);
    }
  }, [options.position, options.min, options.max, options.enabled, options.scopeKey, stop]);

  // 退出循环：先把无界位置折回 [0, loopCount)，后面的归位 / 夹取就不会把画面拉到最后一张
  const previousLoop = useRef(options.loopCount);
  useLayoutEffect(() => {
    const previous = previousLoop.current;
    previousLoop.current = options.loopCount;
    if (!previous || options.loopCount) return;
    const folded = wrapGalleryPosition(positionRef.current, previous);
    const target = motion.current?.target;
    stop(false);
    positionRef.current = folded;
    latest.current.onFrame(folded);
    if (target !== null && target !== undefined) moveTo(wrapGalleryPosition(target, previous));
    else commit();
  }, [options.loopCount, stop, moveTo, commit]);

  const autoInterval = options.autoInterval?.();
  useEffect(() => {
    if (canAutoRun()) {
      resetAutoClock();
      // 刚点开巡游：中心布局约 0.6 秒后就翻第一张，不必干等一整段停留；之后照常按停留时间翻
      const interval = latest.current.autoInterval?.();
      if (interval && options.autoRun && !wasAutoRunning.current)
        carousel.current = {...carousel.current, elapsed: Math.max(0, interval - FIRST_TURN_DELAY)};
      previousAt.current = 0;
      schedule();
    } else if (wasAutoRunning.current && !options.autoRun && !gesture.current && (!motion.current || autoTransition.current)) {
      if (options.snap) moveTo(Math.round(positionRef.current));
      else if (Math.abs(lastAutoVelocity.current) > .01 && !reduced.current) {
        // 关闭自动运动：带着当前速度滑行减速到停，而不是瞬间定住
        const v = lastAutoVelocity.current; lastAutoVelocity.current = 0;
        stop(false);
        motion.current = {position: positionRef.current, velocity: v, phase: 'coast', target: null};
        previousAt.current = performance.now();
        schedule();
      } else stop();
    }
    wasAutoRunning.current = !!options.autoRun;
  }, [options.autoRun, options.snap, autoInterval, canAutoRun, moveTo, resetAutoClock, schedule, stop]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const resume = () => {
      if (canAutoRun()) {
        resetAutoClock();
        previousAt.current = 0; schedule();
      }
    };
    const change = () => {
      reduced.current = preference.matches;
      if (preference.matches) {
        const target = latest.current.snap ? Math.round(positionRef.current) : positionRef.current;
        moveTo(target, false);
      } else resume();
    };
    const hide = () => {if (document.hidden) stop(); else resume();};
    const blur = () => {pressedPointers.current.clear();};   // 窗口失焦不再打断运动；真正切走（页面隐藏）由 visibilitychange 处理
    const focus = () => {blurred.current = false; resume();};
    const release = (event: globalThis.PointerEvent) => {
      if (!pressedPointers.current.delete(event.pointerId)) return;
      resetAutoClock();
      if (!pressedPointers.current.size) resume();
    };
    const observer = new MutationObserver(() => {
      if ((gesture.current || motion.current || frame.current) && hasGalleryOverlay()) stop();
      else if (!frame.current) resume();
    });
    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['open']});
    preference.addEventListener('change', change);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', change);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
      motion.current = null;
      stepTarget.current = null;
      const active = gesture.current;
      gesture.current = null;
      if (active) releaseCapture(active);
    };
  }, [canAutoRun, moveTo, releaseCapture, resetAutoClock, schedule, stop]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button === 0) pressedPointers.current.add(event.pointerId);
    // Every new down denotes a new intentional tap, not the old drag's synthetic click.
    trailingClick.current = false;
    if (!event.isPrimary || (gesture.current && gesture.current.id !== event.pointerId)) {stop(); return;}
    if (event.button !== 0 || latest.current.enabled === false || document.hidden ||
        hasGalleryOverlay()) return;
    if ((event.target as HTMLElement).closest('.gallery-stage-controls, a, input, textarea, select')) return;
    if (event.pointerType === 'touch' && event.clientX < 28) {stop(); return;}
    stop(false);
    gesture.current = {id: event.pointerId, start: {x: event.clientX, y: event.clientY},
      position: positionRef.current, anchor: (event.target as HTMLElement).closest<HTMLElement>('[data-motion-index]'),
      element: event.currentTarget, moved: false, samples: [{position: positionRef.current, at: event.timeStamp}]};
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!event.isPrimary) {stop(); return;}
    if (!active || active.id !== event.pointerId) return;
    const point = {x: event.clientX, y: event.clientY};
    if (!active.moved && Math.hypot(point.x - active.start.x, point.y - active.start.y) < 3) return;
    if (!active.moved) {
      active.moved = true;
      draggingRef.current = true;
      latest.current.onDragStart?.();
      // Capturing only after movement preserves a normal button tap's click target.
      try {active.element.setPointerCapture(active.id);} catch { /* Canceled / synthetic pointer. */ }
    }
    if (event.cancelable) event.preventDefault();
    const {min, max} = bounds();
    positionRef.current = clampGalleryPosition(latest.current.project(active.start, point, active.position, active.anchor), min, max);
    active.samples.push({position: positionRef.current, at: event.timeStamp});
    active.samples = active.samples.filter(sample => event.timeStamp - sample.at <= 120);
    schedule();
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    // Include the final point, including a pause before release, in release velocity.
    if (active.moved) onPointerMove(event);
    gesture.current = null;
    draggingRef.current = false;
    resetAutoClock();
    releaseCapture(active);
    if (!active.moved) {motion.current = null; if (latest.current.autoRun && !reduced.current) schedule(); return;}
    trailingClick.current = true;
    latest.current.onDragEnd?.();
    if (reduced.current) {
      positionRef.current = latest.current.snap ? Math.round(positionRef.current) : positionRef.current;
      latest.current.onFrame(positionRef.current);
      commit();
      return;
    }
    const {min, max} = bounds();
    const limit = latest.current.releaseVelocityLimit ?? 10;
    const velocity = Math.max(-limit, Math.min(limit, galleryReleaseVelocity(active.samples)));
    motion.current = releaseGalleryMotion(positionRef.current, velocity, min, max, latest.current.snap);
    previousAt.current = performance.now();
    if (motion.current.phase === 'idle') {
      motion.current = null; latest.current.onFrame(positionRef.current); commit();
      if (latest.current.autoRun) schedule();
    }
    else schedule();
  };
  const cancelPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.id !== event.pointerId) return;
    const moved = gesture.current.moved;
    stop();
    resetAutoClock();
    if (latest.current.autoRun && !reduced.current) schedule();
    trailingClick.current = moved;
  };
  const lostCapture = (event: PointerEvent<HTMLDivElement>) => {
    // A touch button's implicit capture is intentionally transferred to the rail.
    // Its bubbled lostcapture event does not mean the rail lost its own capture.
    if (event.target === event.currentTarget) cancelPointer(event);
  };
  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (event.detail === 0) {if (!draggingRef.current) trailingClick.current = false; return;}
    if (draggingRef.current || trailingClick.current) {
      trailingClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return {positionRef, draggingRef, navigationTarget, moveTo, step, stop,
    isClickSuppressed: () => draggingRef.current || trailingClick.current,
    handlers: {onPointerDown, onPointerMove, onPointerUp,
      onPointerCancel: cancelPointer, onLostPointerCapture: lostCapture, onClickCapture}};
}
