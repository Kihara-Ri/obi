import {Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {AlbumRecord} from '../types';
import type {AlbumOrientationPermission} from './useAlbumOrientation';
import {useApp} from '../state/AppContext';
import {publishedAlbum} from '../core/published-album';
import {commitAnimationOpacity, containedImageRect, coverRectFrames, FOCUS_RADIUS, THUMB_RADIUS} from '../core/gallery-zoom';
import type {ZoomRect} from '../core/gallery-zoom';
import {ChevLeftIco, ChevRightIco} from './icons';
import {Seg} from './ui/Seg';
import {GearIcon} from './ui/GearIcon';
import {TwinControls} from './TwinControls';
import {AlbumFlipCard} from './AlbumFlipCard';
import {navigate as goTo} from '../core/nav';

class EngineBoundary extends Component<{children: ReactNode; onUnavailable(): void}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() {return {failed: true};}
  componentDidCatch() {this.props.onUnavailable();}
  render() {return this.state.failed ? null : this.props.children;}
}

const ZOOM_MS = 260;
const ZOOM_EASE = 'cubic-bezier(.2,.7,.3,1)';
const SHADE_MS = 150;
const SLIDE_MS = 200;

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
export function GalleryFocus({record, records, originElement, onNavigate, onClose, liked, collectedAt}: {
  record: AlbumRecord;
  records: AlbumRecord[];
  originElement: HTMLElement | null;
  onNavigate(id: string): void;
  onClose(): void;
  liked: boolean;
  collectedAt?: string;
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
  const [modelSession, setModelSession] = useState<{id: string; permission: Promise<AlbumOrientationPermission>} | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [flipped, setFlipped] = useState(false);
  // 「实体设置」面板（D-015：数字实体入口在展示灯箱，不在编辑表单）；灯箱是 top-layer 的 dialog，面板必须画在它里面
  const [twinOpen, setTwinOpen] = useState(false);
  // A failed lazy load belongs to this explicit attempt; the next click may retry.
  const AlbumModel = useMemo(() => lazy(() => import('./AlbumModel').then(module => ({default: module.AlbumModel}))), [modelSession]);
  const currentRecordId = useRef(record.id);
  const thumbnailOrigin = useRef(originElement);
  const current = useRef({record, records, onNavigate, onClose});
  current.current = {record, records, onNavigate, onClose};
  const requestClose = useRef<() => void>(() => {});
  const app = useApp(), job = app.twins.jobs[record.id];
  const published = useMemo(() => publishedAlbum(record, job, app.albumEngine.runtime), [record, job, app.albumEngine.runtime]);
  const showing3D = !!published && modelSession?.id === record.id;
  const twinOpenRef = useRef(false); twinOpenRef.current = twinOpen;
  useEffect(() => {setTwinOpen(false);}, [record.id]);
  const hasTwin = !!job || !!published; // 有实体或有任务才有可设置的内容；生成在 Album Engine 项目里
  const dismissModel = useCallback(() => requestClose.current(), []);
  useLayoutEffect(() => {if (!app.albumEngine.runtime) setModelSession(null);}, [app.albumEngine.runtime]);
  const engineUnavailable = useCallback(() => {setModelSession(null); setUnavailable(true);}, []);

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
    // Use the untransformed card geometry, not the rotated inner face's
    // bounding box. This also keeps the reverse zoom valid after a flip.
    const card = root.querySelector<HTMLElement>('.album-flip-card');
    const image = root.querySelector<HTMLElement>('img.gallery-focus-cover, .gallery-focus-cover img');
    const scene = root.querySelector<HTMLElement>('.gallery-model-mount');
    const container = card || image || scene;
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
    if (afterSwitch && slideDir.current && !reducedMotion()) {
      element.style.transform = ''; element.style.opacity = '';
      const by = slideDir.current; slideDir.current = null;
      slideIn(by);
      return;
    }
    const source = findSource(id);
    const aspect = coverAspect(source);
    const thumbnail = visibleThumbnail(source, aspect);
    const large = expandedCover(aspect);
    const proxy = coverProxy.current;
    if (!reducedMotion() && current.current.record.cover && proxy && thumbnail && large) {
      // Animate image pixels only, with both endpoints fitted to the *same*
      // intrinsic aspect ratio. Text and the (possibly 3D) model do not stretch.
      element.style.opacity = '0'; element.style.pointerEvents = 'none';
      const [from, to] = coverRectFrames(thumbnail, large, [THUMB_RADIUS, FOCUS_RADIUS]);
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
    const currentRadius = ongoing && proxy ? parseFloat(getComputedStyle(proxy).borderTopLeftRadius) || THUMB_RADIUS : FOCUS_RADIUS;
    element.getAnimations().forEach(item => item.cancel());
    visualAnimation.current = null;
    resetCoverProxy();
    let animation: Animation | null = null;
    if (current.current.record.cover && proxy && thumbnail && currentRect) {
      element.style.opacity = '0'; element.style.pointerEvents = 'none';
      const [from, to] = coverRectFrames(currentRect, thumbnail, [currentRadius, THUMB_RADIUS]);
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

  const navRef = useRef<(by: -1 | 1, fromDx?: number) => void>(() => {});
  requestClose.current = () => {
    if (closing.current) return;
    closing.current = true;
    setFlipped(false);
    switching.current = false;
    setTransitionStatus('');
    animateOut(currentRecordId.current, () => current.current.onClose(), true);
  };

  // 切换专辑：不再缩回缩略图（缩略图可能不在视口里），整张封面横向滑出、下一张从另一侧滑入；
  // 缩放过渡只留给打开 / 关闭。fromDx = 手指松开时封面已被拖出的距离，从那里接着滑
  const slideDir = useRef<-1 | 1 | null>(null);
  const slideOut = (by: -1 | 1, fromDx: number, after: () => void) => {
    const element = visual.current;
    slideDir.current = by;
    if (!element || reducedMotion()) {after(); return;}
    visualAnimation.current?.cancel();
    element.style.transform = ''; element.style.opacity = '';
    const animation = element.animate([
      {transform: `translateX(${fromDx}px)`, opacity: Math.max(0, 1 - Math.abs(fromDx) / innerWidth * .5)},
      {transform: `translateX(${-by * innerWidth * .6}px)`, opacity: 0}],
    {duration: SLIDE_MS, easing: ZOOM_EASE, fill: 'forwards'});
    visualAnimation.current = animation;
    animation.finished.then(() => {if (visualAnimation.current === animation) after();}).catch(() => {});
  };
  const slideIn = (by: -1 | 1) => {
    const element = visual.current;
    if (!element) return;
    element.style.pointerEvents = '';
    const animation = element.animate([
      {transform: `translateX(${by * innerWidth * .6}px)`, opacity: 0}, {transform: 'none', opacity: 1}],
    {duration: SLIDE_MS + 40, easing: ZOOM_EASE, fill: 'both'});
    visualAnimation.current = animation;
    animation.finished.then(() => {
      if (visualAnimation.current !== animation) return;
      visualAnimation.current = null; animation.cancel(); showFull(true);
    }).catch(() => {});
  };

  const navigate = (by: -1 | 1, fromDx = 0) => {
    if (closing.current || switching.current) return;
    const list = current.current.records;
    const index = list.findIndex(item => item.id === currentRecordId.current);
    const next = list[index + by];
    if (!next) return;
    switching.current = true;
    setFlipped(false);
    setTransitionStatus('正在切换到：' + next.title);
    slideOut(by, fromDx, () => current.current.onNavigate(next.id));
  };
  navRef.current = navigate;

  // 手机：左右拖动切换专辑（取代遮住画面的左右按钮）。封面跟手；够远或够快松手 = 切换，否则回弹；
  // 竖向为主、3D 模式（自己占用拖动）、实体设置面板与 2D/3D 开关上的手势不算
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    let start: {x: number; y: number; t: number} | null = null;
    let drag = false, dx = 0, v = 0, lastX = 0, lastT = 0;
    const move = (x: number) => {
      const list = current.current.records;
      const i = list.findIndex(item => item.id === currentRecordId.current);
      const blocked = (x < 0 && i >= list.length - 1) || (x > 0 && i <= 0);
      const shown = blocked ? x * .3 : x;   // 到头了：有阻尼，示意没有更多
      if (visual.current) {
        visual.current.style.transform = `translateX(${shown}px)`;
        visual.current.style.opacity = String(Math.max(.35, 1 - Math.abs(shown) / innerWidth * .5));
      }
      return shown;
    };
    const onStart = (e: TouchEvent) => {
      const target = e.target as Element;
      drag = false; dx = 0; v = 0;
      start = e.touches.length === 1 && !closing.current && !switching.current
        && !target.closest('.gallery-twin-panel,.gallery-renderer-switch,.gallery-model-mount,.gallery-twin-open')
        ? {x: e.touches[0].clientX, y: e.touches[0].clientY, t: e.timeStamp} : null;
      lastX = start?.x ?? 0; lastT = e.timeStamp;
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const t = e.touches[0], ddx = t.clientX - start.x, ddy = t.clientY - start.y;
      if (!drag) {
        if (Math.abs(ddx) < 10 || Math.abs(ddx) < Math.abs(ddy) * 1.3) {if (Math.abs(ddy) > 14) start = null; return;}
        drag = true;
        visualAnimation.current?.cancel(); visualAnimation.current = null;
      }
      if (e.cancelable) e.preventDefault();
      const dt = e.timeStamp - lastT;
      if (dt > 0) {v = (t.clientX - lastX) / dt; lastX = t.clientX; lastT = e.timeStamp;}
      dx = ddx; move(ddx);
    };
    const onEnd = () => {
      if (!start || !drag) {start = null; return;}
      start = null; drag = false;
      const by: -1 | 1 = dx < 0 ? 1 : -1;
      const list = current.current.records;
      const i = list.findIndex(item => item.id === currentRecordId.current);
      const has = !!list[i + by];
      const far = Math.abs(dx) > Math.min(110, innerWidth * .25), fling = Math.abs(dx) > 30 && Math.abs(v) > .5 && Math.sign(v) === Math.sign(dx);
      if (has && (far || fling)) {navRef.current(by, move(dx)); return;}
      const el = visual.current; if (!el) return;
      const from = el.style.transform || 'none', fromO = el.style.opacity || '1';
      el.style.transform = ''; el.style.opacity = '';
      el.animate([{transform: from, opacity: fromO}, {transform: 'none', opacity: 1}], {duration: 220, easing: ZOOM_EASE});
    };
    element.addEventListener('touchstart', onStart, {passive: true});
    element.addEventListener('touchmove', onMove, {passive: false});
    element.addEventListener('touchend', onEnd, {passive: true});
    element.addEventListener('touchcancel', onEnd, {passive: true});
    return () => {
      element.removeEventListener('touchstart', onStart); element.removeEventListener('touchmove', onMove);
      element.removeEventListener('touchend', onEnd); element.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const html = document.documentElement;
    const overflow = html.style.overflow;
    const x = window.scrollX, y = window.scrollY;
    html.style.overflow = 'hidden';
    element.showModal();
    element.focus({preventScroll: true});
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
    setFlipped(false);
    setModelSession(null); setUnavailable(false);
    // 切到别的专辑：把下层对应的缩略图滚到合适位置（竖向居中、横向就近），收回时才有地方落
    if (changed) findThumbnail(record.id)?.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'instant'});
    playIntro(record.id, changed && switching.current);
  }, [record.id]);

  const index = records.findIndex(item => item.id === record.id);
  const previous = index > 0;
  const next = index >= 0 && index < records.length - 1;

  return createPortal(<dialog id="gallery-focus" className="gallery-focus" ref={dialog} tabIndex={-1}
    aria-labelledby="gallery-focus-title" data-task-id={job?.id ?? ''} onCancel={event => {event.preventDefault(); requestClose.current();}}
    onKeyDown={event => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        if (twinOpenRef.current) setTwinOpen(false); else requestClose.current(); // Esc 先关面板，再关灯箱
      }
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
    <div className={`gallery-focus-visual${showing3D ? ' gallery-focus-visual--model' : ''}`} ref={visual}>
      {showing3D && published && modelSession ? <div className="gallery-model-mount">
        <EngineBoundary onUnavailable={engineUnavailable}>
          <Suspense fallback={<p className="gallery-engine-loading" role="status">正在加载 3D</p>}>
            <AlbumModel entity={published.entity} resolveAsset={published.resolveAsset} modelBaseUrl={job?.models ? '/api/twin-model-assets/' + job.id + '/' : undefined} permission={modelSession.permission}
              onDismiss={dismissModel} onUnavailable={engineUnavailable}/>
          </Suspense>
        </EngineBoundary>
      </div>
        : <AlbumFlipCard record={record} flipped={flipped} liked={liked}
            collectedAt={collectedAt}
            onFlip={() => {if (!closing.current && !switching.current) setFlipped(v => !v);}}/>}
      <h2 id="gallery-focus-title">{record.title}</h2>
    </div>
    {published ? <div className="gallery-renderer-switch">
      <Seg ariaLabel="专辑显示" options={[{value: '2d', label: '2D'}, {value: '3d', label: '3D'}]}
        value={showing3D ? '3d' : '2d'} onValue={mode => {
          if (mode === '2d') setModelSession(null);
          else {setFlipped(false); setUnavailable(false); setModelSession({id: record.id, permission: app.albumEngine.runtime!.requestAlbumOrientationPermission()});}
        }}/>
    </div> : null}
    {hasTwin ? <button type="button" className="gallery-twin-open" aria-expanded={twinOpen} onClick={() => setTwinOpen(v => !v)}>
      <GearIcon size={16}/><span>实体设置</span></button> : null}
    {twinOpen && hasTwin ? <section className="gallery-twin-panel" aria-label="实体设置">
      <header><strong>实体设置</strong><button type="button" className="quiet" aria-label="关闭实体设置" onClick={() => setTwinOpen(false)}>×</button></header>
      <TwinControls record={record} releaseId={record.releaseInfo?.musicBrainzReleaseId || ''}
        onSettings={() => goTo('#settings')}/>
    </section> : null}
    {unavailable ? <p className="gallery-engine-unavailable" role="status">3D 暂不可用，可重试</p> : null}
    {record.cover ? <img ref={coverProxy} className="gallery-focus-transition-image" src={record.cover}
      alt="" aria-hidden="true" draggable={false}/> : null}
    <span className="gallery-visually-hidden" role="status" aria-live="polite">{transitionStatus}</span>
    {/* Keep the 3D paper/CD edge grips reachable; the 2D gallery navigation
        arrows otherwise cover the left/right 52-pixel model interaction zone. */}
    {records.length > 1 && !showing3D ? <>
      <button type="button" className="gallery-focus-nav gallery-focus-prev" aria-label="上一张专辑" disabled={!previous}
        onClick={event => {event.stopPropagation(); navigate(-1);}}>{ChevLeftIco}</button>
      <button type="button" className="gallery-focus-nav gallery-focus-next" aria-label="下一张专辑" disabled={!next}
        onClick={event => {event.stopPropagation(); navigate(1);}}>{ChevRightIco}</button>
    </> : null}
  </dialog>, document.body);
}
