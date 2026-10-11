import {useCallback, useEffect, useRef, useState} from 'react';
import type {KeyboardEvent, PointerEvent} from 'react';
import type {AlbumRecord} from '../types';
import {albumPackaging} from '../core/album-packaging';
import {AlbumPackagingBody} from './AlbumPackagingBody';
import {useAlbumOrientation} from './useAlbumOrientation';
import type {AlbumOrientationPermission} from './useAlbumOrientation';

type Pose = {x: number; y: number};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Six local faces, not a skewed cover. All input drives the same pose and light. */
export function CSSAlbumModel({record, permission, onDismiss}: {
  record: AlbumRecord; permission: Promise<AlbumOrientationPermission>; onDismiss(): void;
}) {
  const scene = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const positioner = useRef<HTMLDivElement>(null);
  const fitOffset = useRef({x: 0, y: 0});
  const repaint = useRef<() => void>(() => {});
  const base = useRef<Pose>({x: -8, y: -16});
  const offset = useRef<Pose>({x: 0, y: 0});
  const shown = useRef<Pose>({...base.current});
  const goal = useRef<Pose>({...base.current});
  const frame = useRef(0);
  const reduced = useRef(false);
  const live = useRef(true);
  const drag = useRef<{id: number; x: number; y: number; pose: Pose; width: number; moved: boolean} | null>(null);
  const trailingClick = useRef(false);
  const tapCase = useRef(false);
  const opening = useRef({target: 0, progress: 0});
  const [dragging, setDragging] = useState(false);
  const [available, setAvailable] = useState(true);
  const packaging = albumPackaging(record.version, record.packaging);
  const modelRef = useRef(packaging); modelRef.current = packaging;
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const model = body.current;
    const space = scene.current;
    if (!model || !space) return;
    const size = () => {
      // Fit both dimensions together; max-width alone would squash a tall phone's case.
      const height = Math.min(space.clientHeight * .84, 680, space.clientWidth * .88 / packaging.aspect);
      const width = height * packaging.aspect;
      model.style.setProperty('--album-width', `${width}px`);
      model.style.setProperty('--album-height', `${height}px`);
      model.style.setProperty('--album-disc-size', `${Math.min(width, height) * .9}px`);
      positioner.current?.style.setProperty('--album-width', `${width}px`);
      positioner.current?.style.setProperty('--album-height', `${height}px`);
      model.style.setProperty('--album-depth', `${Math.max(2, width * packaging.depth)}px`);
      model.style.setProperty('--album-aspect', String(packaging.aspect));
      model.style.setProperty('--album-material-gloss', String(packaging.gloss));
      repaint.current();
    };
    size();
    const observer = new ResizeObserver(size); observer.observe(space);
    return () => observer.disconnect();
  }, [packaging.aspect, packaging.depth, packaging.gloss]);

  const paint = useCallback((pose: Pose) => {
    const model = body.current;
    if (!model) return;
    const yaw = pose.y * Math.PI / 180, pitch = pose.x * Math.PI / 180;
    model.style.setProperty('--album-rx', `${pose.x.toFixed(3)}deg`);
    model.style.setProperty('--album-ry', `${pose.y.toFixed(3)}deg`);
    // A fixed environment reflection sweeps across the plastic as its normal turns.
    model.style.setProperty('--album-light-x', `${50 + Math.sin(yaw) * 65}%`);
    model.style.setProperty('--album-light-y', `${35 - Math.sin(pitch) * 60}%`);
    model.style.setProperty('--album-gloss-angle', `${115 + Math.sin(yaw) * 45 + Math.sin(pitch) * 20}deg`);
    model.style.setProperty('--album-gloss', String(.14 + Math.abs(Math.sin(yaw)) * .24 + Math.abs(Math.sin(pitch)) * .14));
    model.style.setProperty('--album-edge-light', String(.22 + Math.abs(Math.sin(yaw)) * .4 + Math.abs(Math.sin(pitch)) * .18));
    const spec = modelRef.current;
    const progress = opening.current.progress;
    const panels = spec.kind === 'gatefold' || spec.kind === 'digipak' ? spec.panels : 2;
    const spread = spec.kind === 'rigid-box' ? .55 : (panels - 1) * .75;
    model.style.setProperty('--album-open-progress', String(progress));
    model.style.setProperty('--album-open-angle', (progress * (spec.kind === 'jewel' ? 145 : 165)) + 'deg');
    model.style.setProperty('--album-scale', String(1 / (1 + (spread + (spec.slipcase ? .4 : 0)) * progress)));
    model.style.setProperty('--album-center-shift', '0px');
    model.style.setProperty('--album-center-y', '0px');
    // Fit the assembled parts, including opened leaves and an extracted slipcase.
    // Texture loading does not affect these face bounds; the title stays outside.
    const space = scene.current?.getBoundingClientRect();
    const wrapper = positioner.current;
    const faces = Array.from(model.querySelectorAll('.album-part-face,.album-slipcase-front'));
    const bounds = () => {
      const boxes = faces.map(face => face.getBoundingClientRect());
      return {left: Math.min(...boxes.map(b => b.left)), right: Math.max(...boxes.map(b => b.right)),
        top: Math.min(...boxes.map(b => b.top)), bottom: Math.max(...boxes.map(b => b.bottom))};
    };
    if (wrapper && space && space.width > 1 && faces.length) {
      let box = bounds();
      const fit = Math.min(1, space.width * .92 / Math.max(1, box.right - box.left), space.height * .9 / Math.max(1, box.bottom - box.top));
      if (fit < 1) {
        model.style.setProperty('--album-scale', String(fit / (1 + (spread + (spec.slipcase ? .4 : 0)) * progress)));
        box = bounds();
      }
      fitOffset.current.x += space.left + space.width / 2 - (box.left + box.right) / 2;
      fitOffset.current.y += space.top + space.height / 2 - (box.top + box.bottom) / 2;
      wrapper.style.transform = 'translate(' + fitOffset.current.x + 'px,' + fitOffset.current.y + 'px)';
    }
    scene.current?.style.setProperty('--album-shadow-x', `${Math.sin(yaw) * -16}px`);
  }, []);
  repaint.current = () => paint(shown.current);

  const move = useCallback((instant = false) => {
    goal.current = {x: clamp(base.current.x + offset.current.x, -72, 72), y: base.current.y + offset.current.y};
    if (reduced.current || !live.current) {
      cancelAnimationFrame(frame.current); frame.current = 0;
      opening.current.progress = opening.current.target;
      shown.current = {...goal.current}; paint(shown.current); return;
    }
    if (instant) {shown.current = {...goal.current}; paint(shown.current);}
    if (frame.current) return;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(.05, (now - previous) / 1000);
      const amount = 1 - Math.exp(-20 * elapsed);
      const unfoldAmount = 1 - Math.exp(-12 * elapsed);
      previous = now;
      const dx = goal.current.x - shown.current.x, dy = goal.current.y - shown.current.y;
      const unfolding = opening.current.target - opening.current.progress;
      if (Math.abs(dx) + Math.abs(dy) < .02 && Math.abs(unfolding) < .001) {
        opening.current.progress = opening.current.target;
        shown.current = {...goal.current}; paint(shown.current); frame.current = 0; return;
      }
      shown.current = {x: shown.current.x + dx * amount, y: shown.current.y + dy * amount};
      opening.current.progress += unfolding * unfoldAmount;
      paint(shown.current); frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [paint]);

  const onTilt = useCallback((x: number, y: number) => {
    offset.current = {x, y}; move();
  }, [move]);
  const motion = useAlbumOrientation({active: available && !dragging, permission, onTilt});

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => {
      reduced.current = media.matches;
      offset.current = {x: 0, y: 0}; move(true);
    };
    changed(); media.addEventListener('change', changed);
    const visibility = () => {
      live.current = document.visibilityState !== 'hidden';
      if (!live.current) {cancelAnimationFrame(frame.current); frame.current = 0;}
      else move(true);
    };
    // The shared photo lightbox covers this viewer. Pause automatic input beneath it.
    const covered = () => setAvailable(!document.getElementById('lightbox') && !document.querySelector('.drawer.closing'));
    const observer = new MutationObserver(covered);
    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
    document.addEventListener('visibilitychange', visibility);
    covered(); visibility();
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame.current); frame.current = 0;
      media.removeEventListener('change', changed); document.removeEventListener('visibilitychange', visibility);
    };
  }, [move]);

  useEffect(() => {
    base.current = reduced.current ? {x: 0, y: 0} : {x: -8, y: -16};
    opening.current = {target: 0, progress: 0}; setOpened(false);
    offset.current = {x: 0, y: 0}; drag.current = null; setDragging(false);
    move(true); motion.recalibrate();
  }, [record.id, packaging.kind]); // A new copy starts from its front; sensor intent stays in this viewer.

  const stopDrag = () => {
    const pointer = drag.current;
    if (pointer?.moved) trailingClick.current = true;
    drag.current = null; setDragging(false);
    if (pointer && scene.current?.hasPointerCapture(pointer.id)) scene.current.releasePointerCapture(pointer.id);
    motion.recalibrate();
  };
  const hitsCase = (x: number, y: number) => Array.from(body.current?.querySelectorAll('.album-part-face,.album-slipcase-front') ?? [])
    .some(face => {const box = face.getBoundingClientRect(); return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;});
  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    tapCase.current = false;
    if (!event.isPrimary) {stopDrag(); trailingClick.current = true; return;}
    trailingClick.current = false;
    if (event.button !== 0 || event.clientX < 28 || drag.current || !available || !hitsCase(event.clientX, event.clientY)) return;
    tapCase.current = true;
    // Continue from the actual rendered pose, including the current sensor/hover tilt.
    base.current = {...shown.current}; offset.current = {x: 0, y: 0};
    drag.current = {id: event.pointerId, x: event.clientX, y: event.clientY,
      pose: {...base.current}, width: event.currentTarget.clientWidth, moved: false};
    setDragging(true); event.currentTarget.focus({preventScroll: true});
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start?.id === event.pointerId) {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) start.moved = true;
      base.current = {x: clamp(start.pose.x - (event.clientY - start.y) / start.width * 150, -65, 65),
        y: start.pose.y + (event.clientX - start.x) / start.width * 220};
      move(true); return;
    }
    if (!available || event.pointerType !== 'mouse' || event.buttons || motion.intended || reduced.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    offset.current = {x: (0.5 - clamp((event.clientY - rect.top) / rect.height, 0, 1)) * 24,
      y: (clamp((event.clientX - rect.left) / rect.width, 0, 1) - .5) * 32};
    move();
  };
  const turn = (x: number, y: number) => {
    base.current = {x: clamp(base.current.x + x, -65, 65), y: base.current.y + y};
    offset.current = {x: 0, y: 0}; motion.recalibrate(); move();
  };
  const reset = () => {
    // Choose the nearest equivalent front to avoid spinning back through whole turns.
    base.current = {x: 0, y: Math.round(shown.current.y / 360) * 360};
    offset.current = {x: 0, y: 0}; motion.recalibrate(); move();
  };
  const toggleOpen = () => {
    if (!packaging.canOpen) return;
    opening.current.target = opening.current.target ? 0 : 1;
    setOpened(!!opening.current.target); move();
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !available) return;
    const commands: Record<string, () => void> = {
      ArrowLeft: () => turn(0, -25), ArrowRight: () => turn(0, 25),
      ArrowUp: () => turn(15, 0), ArrowDown: () => turn(-15, 0), Home: reset,
      Enter: toggleOpen, ' ': toggleOpen,
    };
    if (commands[event.key]) {event.preventDefault(); event.stopPropagation(); commands[event.key]();}
  };

  return <div className="album-viewer">
    <div className={`album-model-scene${dragging ? ' is-dragging' : ''}`} ref={scene} role="group" tabIndex={0}
      aria-label={`3D 专辑：${record.title}`} aria-expanded={packaging.canOpen ? opened : undefined}
      aria-description={packaging.canOpen ? '拖动或方向键旋转，点击或 Enter 开合，Home 回到正面，Esc 关闭。' : '拖动或方向键旋转，Home 回到正面，Esc 关闭。'}
      onKeyDown={onKey} onDragStart={event => event.preventDefault()} onPointerDown={onDown}
      onPointerMove={onMove} onPointerUp={stopDrag}
      onPointerCancel={() => {tapCase.current = false; stopDrag(); trailingClick.current = true;}}
      onLostPointerCapture={() => {if (drag.current) stopDrag();}}
      onClick={event => {
        const startedOnCase = tapCase.current; tapCase.current = false;
        if (trailingClick.current) {trailingClick.current = false; event.preventDefault(); event.stopPropagation(); return;}
        // Opening/hover can move a face between press and release. Keep that tap
        // attached to the case it started on, rather than closing the lightbox.
        if (event.detail !== 0 && !startedOnCase) {
          if (!hitsCase(event.clientX, event.clientY)) onDismiss();
          return;
        }
        if (available && !drag.current) toggleOpen();
      }}
      onPointerLeave={() => {if (!drag.current && !motion.intended) {offset.current = {x: 0, y: 0}; move();}}}>
      <div className="album-model-ground" aria-hidden="true"/>
      <div className="album-model-positioner" ref={positioner}>
        <div ref={body} className={`album-model album-model--${packaging.kind}${packaging.miniLP ? ' album-model--mini-lp' : ''}`} aria-hidden="true">
          <AlbumPackagingBody record={record} model={packaging}/>
        </div>
      </div>
    </div>
  </div>;
}
