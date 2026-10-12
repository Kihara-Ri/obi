import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {AlbumRecord} from '../types';
import {AlbumModel} from './AlbumModel';
import type {AlbumOrientationPermission} from './useAlbumOrientation';
import {useApp} from '../state/AppContext';
import {twinViewerRecord} from '../core/digital-twins';
import {commitAnimationOpacity, thumbnailZoomFrames} from '../core/gallery-zoom';
import {ChevLeftIco, ChevRightIco} from './icons';

const ZOOM_MS = 260;
const ZOOM_EASE = 'cubic-bezier(.2,.7,.3,1)';
const SHADE_MS = 150;

function findThumbnail(id: string): HTMLElement | null {
  const matches = Array.from(document.querySelectorAll<HTMLElement>('[data-gallery-record-id]'))
    .filter(element => element.dataset.galleryRecordId === id);
  // Looping tracks can render the same copy more than once. Use its visible
  // instance rather than a buffer tile beyond the viewport.
  return matches.find(element => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0
      && rect.left < innerWidth && rect.top < innerHeight;
  }) ?? matches[0] ?? null;
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Full-screen photo-style focus for a model and album title, with shared cover zoom. */
export function GalleryFocus({record, records, originElement, permission, onNavigate, onClose}: {
  record: AlbumRecord;
  records: AlbumRecord[];
  originElement: HTMLElement | null;
  permission: Promise<AlbumOrientationPermission>;
  onNavigate(id: string): void;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const visual = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const visualAnimation = useRef<Animation | null>(null);
  const shadeAnimation = useRef<Animation | null>(null);
  const exitTimer = useRef(0);
  const switching = useRef(false);
  const closing = useRef(false);
  const [transitionStatus, setTransitionStatus] = useState('');
  const currentRecordId = useRef(record.id);
  const thumbnailOrigin = useRef(originElement);
  const current = useRef({record, records, onNavigate, onClose});
  current.current = {record, records, onNavigate, onClose};
  const requestClose = useRef<() => void>(() => {});
  const app = useApp(), job = app.twins.jobs[record.id];
  const modelRecord = useMemo(() => twinViewerRecord(record, job), [record, job]);

  const playShade = (from: number, to: number) => {
    const element = shade.current;
    if (!element || reducedMotion()) return null;
    shadeAnimation.current?.cancel();
    const animation = element.animate([{opacity: from}, {opacity: to}], {
      duration: SHADE_MS, easing: 'ease', fill: 'both',
    });
    shadeAnimation.current = animation;
    animation.finished.then(() => {
      if (shadeAnimation.current === animation) {
        commitAnimationOpacity(element.style, to, () => animation.cancel());
        shadeAnimation.current = null;
      }
    }).catch(() => {});
    return animation;
  };

  const playIntro = (id: string, afterSwitch: boolean) => {
    const element = visual.current;
    if (!element) return;
    const source = thumbnailOrigin.current?.dataset.galleryRecordId === id && thumbnailOrigin.current.isConnected
      ? thumbnailOrigin.current : findThumbnail(id);
    thumbnailOrigin.current = source;
    const radius = source ? parseFloat(getComputedStyle(source).borderTopLeftRadius) || 0 : 0;
    // A prior close-to-thumbnail animation can still hold its final transform.
    // Cancel and start the incoming zoom in this same layout pass, before paint.
    element.getAnimations().forEach(item => item.cancel());
    visualAnimation.current = null;
    const full = element.getBoundingClientRect();
    const fullRadius = getComputedStyle(element).borderRadius;
    let animation: Animation | null = null;
    if (!reducedMotion()) {
      const frames = source?.isConnected && source.getBoundingClientRect().width
        ? thumbnailZoomFrames(full, source.getBoundingClientRect(), radius, fullRadius)
        : [{transform: 'scale(.96)', borderRadius: fullRadius}, {transform: 'none', borderRadius: fullRadius}];
      animation = element.animate([
        {...frames[0], opacity: 0}, {...frames[1], opacity: 1},
      ], {duration: ZOOM_MS, easing: ZOOM_EASE, fill: 'both'});
      visualAnimation.current = animation;
      animation.finished.then(() => {
        if (visualAnimation.current === animation) {
          element.getAnimations().forEach(item => item.cancel());
          visualAnimation.current = null;
          if (afterSwitch) {switching.current = false; setTransitionStatus('');}
        }
      }).catch(() => {});
      // Keep the scrim steady between cover zooms, so the gallery cannot flash bright.
      if (!afterSwitch) playShade(0, 1);
    } else if (afterSwitch) {switching.current = false; setTransitionStatus('');}
    if (!animation && afterSwitch) {switching.current = false; setTransitionStatus('');}
  };

  const animateOut = (id: string, after: () => void, dismiss = false) => {
    const element = visual.current;
    if (!element || reducedMotion()) {after(); return;}
    window.clearTimeout(exitTimer.current);
    const source = thumbnailOrigin.current?.dataset.galleryRecordId === id && thumbnailOrigin.current.isConnected
      ? thumbnailOrigin.current : findThumbnail(id);
    const fromTransform = getComputedStyle(element).transform;
    const fromRadius = getComputedStyle(element).borderRadius;
    const radius = source ? parseFloat(getComputedStyle(source).borderTopLeftRadius) || 0 : 0;
    element.getAnimations().forEach(item => item.cancel());
    // Measure the untransformed box even when the incoming zoom is interrupted;
    // the first keyframe retains the currently visible transform.
    const rect = element.getBoundingClientRect();
    const thumbnailFrame = source?.isConnected && source.getBoundingClientRect().width
      ? thumbnailZoomFrames(rect, source.getBoundingClientRect(), radius, fromRadius)[0]
      : {transform: 'scale(.96)', borderRadius: fromRadius};
    const animation = element.animate([
      {transform: fromTransform, borderRadius: fromRadius, opacity: 1},
      {...thumbnailFrame, opacity: source ? 1 : 0},
    ], {duration: ZOOM_MS, easing: ZOOM_EASE, fill: 'both'});
    visualAnimation.current = animation;
    if (dismiss) playShade(shade.current ? Number(getComputedStyle(shade.current).opacity) : 1, 0);
    const complete = () => {
      if (visualAnimation.current !== animation) return;
      window.clearTimeout(exitTimer.current); exitTimer.current = 0;
      after();
    };
    // Browsers can defer WAAPI's finished event while a modal or tab is backgrounded.
    // Keep the state transition bounded by the same duration as the visual motion.
    exitTimer.current = window.setTimeout(complete, ZOOM_MS + 120);
    animation.finished.then(complete).catch(() => {});
  };

  requestClose.current = () => {
    if (closing.current) return;
    closing.current = true;
    switching.current = false;
    setTransitionStatus('');
    animateOut(currentRecordId.current, () => current.current.onClose(), true);
  };

  const navigate = (by: -1 | 1) => {
    if (closing.current || switching.current) return;
    const list = current.current.records;
    const index = list.findIndex(item => item.id === currentRecordId.current);
    const next = list[index + by];
    if (!next) return;
    switching.current = true;
    setTransitionStatus('正在切换到：' + next.title);
    animateOut(currentRecordId.current, () => current.current.onNavigate(next.id));
  };

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const html = document.documentElement;
    const overflow = html.style.overflow;
    const x = window.scrollX, y = window.scrollY;
    html.style.overflow = 'hidden';
    element.showModal();
    element.querySelector<HTMLElement>('.album-model-scene, .gallery-focus-cover')?.focus({preventScroll: true});
    const lock = () => {if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);};
    const onHistoryBack = () => requestClose.current();
    window.addEventListener('scroll', lock, {passive: true});
    window.addEventListener('gallery-focus-history-back', onHistoryBack);
    return () => {
      window.removeEventListener('scroll', lock);
      window.removeEventListener('gallery-focus-history-back', onHistoryBack);
      window.clearTimeout(exitTimer.current);
      visualAnimation.current?.cancel(); shadeAnimation.current?.cancel();
      element.close();
      html.style.overflow = overflow;
      window.scrollTo(x, y);
      if (focused?.isConnected) focused.focus({preventScroll: true});
    };
  }, []);

  useLayoutEffect(() => {
    const changed = currentRecordId.current !== record.id;
    currentRecordId.current = record.id;
    playIntro(record.id, changed && switching.current);
  }, [record.id]);

  const index = records.findIndex(item => item.id === record.id);
  const previous = index > 0;
  const next = index >= 0 && index < records.length - 1;

  return createPortal(<dialog id="gallery-focus" className="gallery-focus" ref={dialog}
    aria-labelledby="gallery-focus-title" data-task-id={job?.id ?? ''} onCancel={event => {event.preventDefault(); requestClose.current();}}
    onKeyDown={event => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); requestClose.current();}
      else if (event.key === 'ArrowLeft') {event.preventDefault(); event.stopPropagation(); navigate(-1);}
      else if (event.key === 'ArrowRight') {event.preventDefault(); event.stopPropagation(); navigate(1);}
      else if (event.key === 'Tab') {
        const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex="0"]') ?? [])
          .filter(node => node.getClientRects().length > 0);
        if (!nodes.length) return;
        const focusIndex = nodes.indexOf(document.activeElement as HTMLElement);
        event.preventDefault(); nodes[(focusIndex + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length].focus();
      }
    }}>
    <div className="gallery-focus-shade" ref={shade} aria-hidden="true" onClick={() => requestClose.current()}/>
    <div className="gallery-focus-visual" ref={visual}>
      {modelRecord ? <AlbumModel key={job?.id} record={modelRecord} permission={permission} onDismiss={() => requestClose.current()}/>
        : <div className="gallery-focus-cover" tabIndex={0} role="group" aria-label={'专辑封面：' + record.title}>
          {record.cover ? <img src={record.cover} alt={record.title + '封面'}/> : <span>暂无封面</span>}
        </div>}
      <h2 id="gallery-focus-title">{record.title}</h2>
    </div>
    <span className="gallery-visually-hidden" role="status" aria-live="polite">{transitionStatus}</span>
    {records.length > 1 ? <>
      <button type="button" className="gallery-focus-nav gallery-focus-prev" aria-label="上一张专辑" disabled={!previous}
        onClick={event => {event.stopPropagation(); navigate(-1);}}>{ChevLeftIco}</button>
      <button type="button" className="gallery-focus-nav gallery-focus-next" aria-label="下一张专辑" disabled={!next}
        onClick={event => {event.stopPropagation(); navigate(1);}}>{ChevRightIco}</button>
    </> : null}
  </dialog>, document.body);
}
