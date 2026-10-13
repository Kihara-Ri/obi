import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {AlbumRecord} from '../types';
import {AlbumModel} from './AlbumModel';
import type {AlbumOrientationPermission} from './useAlbumOrientation';
import {useApp} from '../state/AppContext';
import {twinViewerRecord} from '../core/digital-twins';
import {commitAnimationOpacity, containedImageRect, coverRectFrames} from '../core/gallery-zoom';
import type {ZoomRect} from '../core/gallery-zoom';
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
  const coverProxy = useRef<HTMLImageElement>(null);
  const coverAnimation = useRef<Animation | null>(null);
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

  const visibleThumbnail = (source: HTMLElement | null, aspect: number): ZoomRect | null => {
    if (!source?.isConnected) return null;
    const image = source.querySelector<HTMLImageElement>('.gallery-artwork img.cover');
    // The button includes shadows/rims and is usually square. The pixels of a
    // portrait cover inside object-fit:contain occupy a smaller painted rectangle.
    const bounds = (image || source).getBoundingClientRect();
    if (!bounds.width || !bounds.height || bounds.right <= 0 || bounds.bottom <= 0
      || bounds.left >= innerWidth || bounds.top >= innerHeight) return null;
    return containedImageRect(bounds, aspect);
  };

  const coverAspect = (source: HTMLElement | null): number => {
    const sourceImage = source?.querySelector<HTMLImageElement>('.gallery-artwork img.cover');
    const image = sourceImage?.naturalWidth ? sourceImage : coverProxy.current;
    return image?.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
  };

  const expandedCover = (aspect: number): ZoomRect | null => {
    const root = visual.current;
    if (!root) return null;
    const image = root.querySelector<HTMLElement>('.gallery-focus-cover img');
    const scene = root.querySelector<HTMLElement>('.album-model-scene');
    const container = image || scene;
    if (!container) return null;
    const bounds = container.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    // A model is a 3D scene: transition its cover into a centred cover-sized
    // preview, then reveal the engine's actual geometry when motion completes.
    const box = image ? bounds : containedImageRect(bounds, 1);
    return containedImageRect(box, aspect);
  };

  const findSource = (id: string) => {
    const source = thumbnailOrigin.current?.dataset.galleryRecordId === id && thumbnailOrigin.current.isConnected
      ? thumbnailOrigin.current : findThumbnail(id);
    thumbnailOrigin.current = source;
    return source;
  };

  const resetCoverProxy = () => {
    coverAnimation.current?.cancel(); coverAnimation.current = null;
    if (coverProxy.current) coverProxy.current.style.opacity = '0';
  };

  const showFull = (afterSwitch: boolean) => {
    if (visual.current) {
      visual.current.style.opacity = '1';
      visual.current.style.pointerEvents = '';
    }
    resetCoverProxy();
    if (afterSwitch) {switching.current = false; setTransitionStatus('');}
  };

  const fadeVisual = (from: number, to: number, complete: () => void) => {
    const element = visual.current;
    if (!element || reducedMotion()) {complete(); return null;}
    visualAnimation.current?.cancel();
    const animation = element.animate([{opacity: from}, {opacity: to}],
      {duration: ZOOM_MS, easing: ZOOM_EASE, fill: 'both'});
    visualAnimation.current = animation;
    animation.finished.then(() => {
      if (visualAnimation.current !== animation) return;
      visualAnimation.current = null;
      animation.cancel(); complete();
    }).catch(() => {});
    return animation;
  };

  const playIntro = (id: string, afterSwitch: boolean) => {
    const element = visual.current;
    if (!element) return;
    window.clearTimeout(exitTimer.current);
    element.getAnimations().forEach(item => item.cancel());
    visualAnimation.current = null;
    resetCoverProxy();
    const source = findSource(id);
    const aspect = coverAspect(source);
    const thumbnail = visibleThumbnail(source, aspect);
    const large = expandedCover(aspect);
    const proxy = coverProxy.current;
    if (!reducedMotion() && current.current.record.cover && proxy && thumbnail && large) {
      // Animate image pixels only, with both endpoints fitted to the *same*
      // intrinsic aspect ratio. Text and the (possibly 3D) model do not stretch.
      element.style.opacity = '0'; element.style.pointerEvents = 'none';
      const [from, to] = coverRectFrames(thumbnail, large);
      Object.assign(proxy.style, {...from, opacity: '1'});
      const animation = proxy.animate([{...from, opacity: 1}, {...to, opacity: 1}],
        {duration: ZOOM_MS, easing: ZOOM_EASE, fill: 'both'});
      coverAnimation.current = animation;
      animation.finished.then(() => {
        if (coverAnimation.current === animation) showFull(afterSwitch);
      }).catch(() => {});
      // Pause display of the backdrop until the exact first image frame is ready.
      if (!afterSwitch) playShade(0, 1);
      return;
    }
    element.style.pointerEvents = '';
    if (!reducedMotion()) {
      element.style.opacity = '0';
      fadeVisual(0, 1, () => showFull(afterSwitch));
      if (!afterSwitch) playShade(0, 1);
    } else showFull(afterSwitch);
  };

  const animateOut = (id: string, after: () => void, dismiss = false) => {
    const element = visual.current;
    if (!element || reducedMotion()) {after(); return;}
    window.clearTimeout(exitTimer.current);
    const source = findSource(id);
    const aspect = coverAspect(source);
    const thumbnail = visibleThumbnail(source, aspect);
    const large = expandedCover(aspect);
    const proxy = coverProxy.current;
    const ongoing = coverAnimation.current;
    // If dismissed during an opening zoom, reverse from its actual on-screen
    // position instead of teleporting to the finished large cover first.
    const currentRect = ongoing && proxy ? proxy.getBoundingClientRect() : large;
    element.getAnimations().forEach(item => item.cancel());
    visualAnimation.current = null;
    resetCoverProxy();
    let animation: Animation | null = null;
    if (current.current.record.cover && proxy && thumbnail && currentRect) {
      element.style.opacity = '0'; element.style.pointerEvents = 'none';
      const [from, to] = coverRectFrames(currentRect, thumbnail);
      Object.assign(proxy.style, {...from, opacity: '1'});
      animation = proxy.animate([{...from, opacity: 1}, {...to, opacity: 1}],
        {duration: ZOOM_MS, easing: ZOOM_EASE, fill: 'both'});
      coverAnimation.current = animation;
    } else {
      element.style.opacity = '1';
      animation = element.animate([{opacity: 1}, {opacity: 0}],
        {duration: ZOOM_MS, easing: ZOOM_EASE, fill: 'both'});
      visualAnimation.current = animation;
    }
    if (dismiss) playShade(shade.current ? Number(getComputedStyle(shade.current).opacity) : 1, 0);
    const complete = () => {
      if (animation && coverAnimation.current !== animation && visualAnimation.current !== animation) return;
      window.clearTimeout(exitTimer.current); exitTimer.current = 0;
      after();
    };
    exitTimer.current = window.setTimeout(complete, ZOOM_MS + 120);
    animation?.finished.then(complete).catch(() => {});
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
      visualAnimation.current?.cancel(); coverAnimation.current?.cancel(); shadeAnimation.current?.cancel();
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
    {record.cover ? <img ref={coverProxy} className="gallery-focus-transition-image" src={record.cover}
      alt="" aria-hidden="true" draggable={false}/> : null}
    <span className="gallery-visually-hidden" role="status" aria-live="polite">{transitionStatus}</span>
    {records.length > 1 ? <>
      <button type="button" className="gallery-focus-nav gallery-focus-prev" aria-label="上一张专辑" disabled={!previous}
        onClick={event => {event.stopPropagation(); navigate(-1);}}>{ChevLeftIco}</button>
      <button type="button" className="gallery-focus-nav gallery-focus-next" aria-label="下一张专辑" disabled={!next}
        onClick={event => {event.stopPropagation(); navigate(1);}}>{ChevRightIco}</button>
    </> : null}
  </dialog>, document.body);
}
