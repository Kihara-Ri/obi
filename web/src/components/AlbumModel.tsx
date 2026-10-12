import {useCallback, useEffect, useRef, useState} from 'react';
import type {KeyboardEvent, PointerEvent} from 'react';
import type {AlbumRecord} from '../types';
import {albumPackaging} from '../core/album-packaging';
import type {AlbumScene, AlbumScenePose} from '../core/album-scene';
import {CSSAlbumModel} from './CSSAlbumModel';
import {useAlbumOrientation} from './useAlbumOrientation';
import type {AlbumOrientationPermission} from './useAlbumOrientation';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** One lazy WebGL scene per lightbox; gallery tracks retain their small CSS proxies. */
export function AlbumModel({record, permission, onDismiss}: {
  record: AlbumRecord; permission: Promise<AlbumOrientationPermission>; onDismiss(): void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<AlbumScene | null>(null);
  const pose = useRef<AlbumScenePose>({x: -8, y: -16, open: 0, zoom: 1, disc: {index: -1, out: 0, x: 0, y: 0}, hint: {index: -1, amount: 0}});
  const base = useRef({x: -8, y: -16});
  const discBase = useRef({x: -8, y: -12});
  const offset = useRef({x: 0, y: 0});
  const target = useRef({x: -8, y: -16, open: 0, discOut: 0, hintIndex: -1});
  const mouse = useRef<{x: number; y: number} | null>(null);
  const nextDisc = useRef<number | null>(null);
  const closeAfterReturn = useRef(false);
  const requestedOpen = useRef(false);
  const frame = useRef(0);
  const reduced = useRef(false);
  const live = useRef(!document.hidden);
  const drag = useRef<{id: number; x: number; y: number; rx: number; ry: number; width: number; moved: boolean; disc: boolean} | null>(null);
  const tapCase = useRef<{disc?: number} | null>(null);
  const trailing = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [opened, setOpened] = useState(false);
  const [ready, setReady] = useState(false);
  const [discStatus, setDiscStatus] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const model = albumPackaging(record.version, record.packaging);

  const move = useCallback((instant = false) => {
    target.current.x = clamp(base.current.x + offset.current.x, -72, 72);
    target.current.y = base.current.y + offset.current.y;
    if (instant || reduced.current) {pose.current.x = target.current.x; pose.current.y = target.current.y;}
    if (reduced.current) pose.current.open = target.current.open;
    if (!live.current || frame.current) return;
    let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(.05, (now - previous) / 1000); previous = now;
      const shown = pose.current, goal = target.current;
      const amount = 1 - Math.exp(-20 * dt);
      shown.x += (goal.x - shown.x) * amount; shown.y += (goal.y - shown.y) * amount;
      shown.open += (goal.open - shown.open) * (reduced.current ? 1 : 1 - Math.exp(-12 * dt));
      shown.disc.out += (goal.discOut - shown.disc.out) * (reduced.current ? 1 : 1 - Math.exp(-9 * dt));
      let hintGoal = shown.hint.index === goal.hintIndex && goal.hintIndex >= 0 ? 1 : 0;
      if (goal.discOut && shown.disc.index === shown.hint.index && shown.disc.out < .52) hintGoal = shown.hint.amount;
      shown.hint.amount += (hintGoal - shown.hint.amount) * (1 - Math.exp(-16 * dt));
      if (Math.abs(hintGoal - shown.hint.amount) < .001) {
        shown.hint.amount = hintGoal;
        if (!hintGoal) shown.hint.index = goal.hintIndex;
      }
      if (Math.abs(goal.discOut - shown.disc.out) < .001) {
        shown.disc.out = goal.discOut;
        if (!goal.discOut) {
          if (nextDisc.current !== null) {
            shown.disc = {index: nextDisc.current, out: 0, x: -8, y: -12}; goal.discOut = 1; nextDisc.current = null;
            discBase.current = {x: -8, y: -12};
          } else {
            setInspecting(false);
            if (closeAfterReturn.current) {goal.open = 0; closeAfterReturn.current = false;}
          }
        }
      }
      const caseSettled = Math.abs(goal.x - shown.x) + Math.abs(goal.y - shown.y) < .02
        && Math.abs(goal.open - shown.open) < .001 && Math.abs(goal.discOut - shown.disc.out) < .001;
      if (caseSettled) {shown.x = goal.x; shown.y = goal.y; shown.open = goal.open;}
      scene.current?.paint(shown);
      // Recheck after tilting: the pointer can stay still while the package moves.
      const pointer = mouse.current;
      if (pointer && !drag.current && !goal.discOut && !reduced.current) {
        goal.hintIndex = scene.current?.hoverDisc(pointer.x, pointer.y, goal.hintIndex) ?? -1;
      }
      if (stage.current) stage.current.dataset.discHover = String(goal.hintIndex >= 0);
      const settled = caseSettled && shown.hint.index === goal.hintIndex
        && Math.abs((goal.hintIndex >= 0 ? 1 : 0) - shown.hint.amount) < .001;
      frame.current = settled ? 0 : requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, []);
  const onTilt = useCallback((x: number, y: number) => {
    if (pose.current.disc.out > 0 || target.current.discOut) {
      pose.current.disc.x = clamp(discBase.current.x + x, -65, 65);
      pose.current.disc.y = discBase.current.y + y;
    } else offset.current = {x, y};
    move();
  }, [move]);
  const motion = useAlbumOrientation({active: ready && !dragging && !fallback, permission, onTilt});

  useEffect(() => {
    let alive = true;
    const space = stage.current, surface = canvas.current;
    if (!space || !surface || fallback) return;
    setReady(false);
    let owned: AlbumScene | null = null;
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); pose.current.zoom = clamp(pose.current.zoom * Math.exp(-event.deltaY * .001), .7, 2); move();
    };
    const contextLost = () => {if (alive) setFallback(true);};
    space.addEventListener('wheel', wheel, {passive: false});
    surface.addEventListener('webglcontextlost', contextLost);
    void import('../core/album-scene').then(async ({AlbumScene}) => {
      if (!alive) return;
      const instance = new AlbumScene(space, surface, record, model);
      owned = instance; scene.current = instance;
      await instance.load();
      if (alive) {instance.paint(pose.current); setReady(true);}
    }).catch(() => {
      owned?.dispose();
      if (alive) {scene.current = null; setFallback(true);}
    });
    return () => {
      alive = false; space.removeEventListener('wheel', wheel); surface.removeEventListener('webglcontextlost', contextLost);
      owned?.dispose(); if (scene.current === owned) scene.current = null;
    };
  }, [record, fallback, move]);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => {
      reduced.current = media.matches; offset.current = {x: 0, y: 0}; mouse.current = null;
      target.current.hintIndex = -1; pose.current.hint = {index: -1, amount: 0}; move(true);
    };
    const visibility = () => {
      live.current = !document.hidden;
      if (!live.current) {
        mouse.current = null; target.current.hintIndex = -1; pose.current.hint = {index: -1, amount: 0};
        cancelAnimationFrame(frame.current); frame.current = 0;
      }
      else move(true);
    };
    preference(); media.addEventListener('change', preference); document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame.current); frame.current = 0;
      media.removeEventListener('change', preference); document.removeEventListener('visibilitychange', visibility);
    };
  }, [move]);

  const clearHint = () => {mouse.current = null; target.current.hintIndex = -1;};

  const stopDrag = () => {
    const pointer = drag.current;
    if (pointer?.moved) trailing.current = true;
    drag.current = null; setDragging(false);
    if (pointer && stage.current?.hasPointerCapture(pointer.id)) stage.current.releasePointerCapture(pointer.id);
    motion.recalibrate();
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    tapCase.current = null;
    clearHint(); move();
    if (!event.isPrimary) {stopDrag(); trailing.current = true; return;}
    trailing.current = false;
    if (!ready || event.button !== 0 || event.clientX < 28 || drag.current) return;
    const hit = scene.current?.pick(event.clientX, event.clientY);
    if (!hit) return;
    tapCase.current = hit;
    const inspecting = hit.disc === pose.current.disc.index && pose.current.disc.out > .95;
    if (inspecting) discBase.current = {x: pose.current.disc.x, y: pose.current.disc.y};
    else {base.current = {x: pose.current.x, y: pose.current.y}; offset.current = {x: 0, y: 0};}
    drag.current = {id: event.pointerId, x: event.clientX, y: event.clientY,
      rx: inspecting ? pose.current.disc.x : base.current.x, ry: inspecting ? pose.current.disc.y : base.current.y,
      width: event.currentTarget.clientWidth, moved: false, disc: inspecting};
    setDragging(true); event.currentTarget.focus({preventScroll: true}); event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start?.id === event.pointerId) {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) start.moved = true;
      const rotation = {x: clamp(start.rx - (event.clientY - start.y) / start.width * 150, -65, 65),
        y: start.ry + (event.clientX - start.x) / start.width * (start.disc ? 360 : 220)};
      if (start.disc) {pose.current.disc.x = rotation.x; pose.current.disc.y = rotation.y; discBase.current = rotation;}
      else base.current = rotation;
      move(true); return;
    }
    if (!ready || event.pointerType !== 'mouse' || event.buttons || reduced.current || inspecting) {
      clearHint(); move(); return;
    }
    mouse.current = {x: event.clientX, y: event.clientY};
    target.current.hintIndex = scene.current?.hoverDisc(event.clientX, event.clientY, target.current.hintIndex) ?? -1;
    if (!motion.intended) {
      const rect = event.currentTarget.getBoundingClientRect();
      offset.current = {x: (.5 - clamp((event.clientY - rect.top) / rect.height, 0, 1)) * 24,
        y: (clamp((event.clientX - rect.left) / rect.width, 0, 1) - .5) * 32};
    }
    move();
  };
  const toggle = () => {
    if (!ready || !model.canOpen) return;
    clearHint();
    requestedOpen.current = !requestedOpen.current;
    closeAfterReturn.current = !requestedOpen.current && pose.current.disc.out > 0;
    nextDisc.current = null;
    if (!requestedOpen.current) {target.current.discOut = 0; setDiscStatus('');}
    target.current.open = closeAfterReturn.current ? 1 : Number(requestedOpen.current);
    setOpened(requestedOpen.current); move();
  };
  const takeDisc = (index: number) => {
    if (!ready || (model.canOpen && (!requestedOpen.current || pose.current.open < .9)) || !scene.current?.discIndices.includes(index)) return;
    clearHint();
    closeAfterReturn.current = false;
    const disc = pose.current.disc;
    setInspecting(true);
    if (disc.index === index && target.current.discOut) {
      target.current.discOut = 0; nextDisc.current = null; setDiscStatus('CD ' + (index + 1) + ' 放回原位');
    } else if (disc.out > 0 && disc.index !== index) {
      target.current.discOut = 0; nextDisc.current = index; setDiscStatus('CD ' + (index + 1) + ' 取出查看');
    } else {
      if (disc.index !== index || !disc.out) {
        pose.current.disc = {index, out: 0, x: -8, y: -12}; discBase.current = {x: -8, y: -12};
      }
      target.current.discOut = 1; nextDisc.current = null; setDiscStatus('CD ' + (index + 1) + ' 取出查看');
    }
    offset.current = {x: 0, y: 0}; move();
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (/^[1-4]$/.test(event.key)) {event.preventDefault(); event.stopPropagation(); takeDisc(Number(event.key) - 1); return;}
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopPropagation();
      if (target.current.discOut) takeDisc(pose.current.disc.index); else toggle(); return;
    }
    const rotation = pose.current.disc.out > .95 ? pose.current.disc : base.current;
    if (event.key === 'Home') {
      event.preventDefault(); rotation.x = 0; rotation.y = Math.round(rotation.y / 360) * 360; pose.current.zoom = 1;
    } else if (event.key.startsWith('Arrow')) {
      event.preventDefault(); event.stopPropagation();
      rotation.x = clamp(rotation.x + (event.key === 'ArrowUp' ? 15 : event.key === 'ArrowDown' ? -15 : 0), -65, 65);
      rotation.y += event.key === 'ArrowRight' ? 25 : event.key === 'ArrowLeft' ? -25 : 0;
    } else return;
    clearHint();
    if (pose.current.disc.out > .95) discBase.current = {x: rotation.x, y: rotation.y};
    offset.current = {x: 0, y: 0}; motion.recalibrate(); move();
  };

  if (fallback) return <CSSAlbumModel record={record} permission={permission} onDismiss={onDismiss}/>;
  return <div className="album-viewer">
    <div className={`album-model-scene album-webgl-scene${dragging ? ' is-dragging' : ''}`} ref={stage} role="group" tabIndex={0}
      aria-label={`3D 专辑：${record.title}`} aria-expanded={model.canOpen ? opened : undefined} aria-busy={!ready}
      aria-description="拖动或方向键旋转，点击包装或 Enter 开合。光标靠近袋口时 CD 轻探出，悬停托盘 CD 时轻抬。点击 CD 取出，拖动查看正反面，再次点击放回；数字键 1 至 4 取放对应 CD。滚轮放大，Home 回正，Esc 关闭。"
      onKeyDown={key} onDragStart={event => event.preventDefault()} onPointerDown={down} onPointerMove={pointerMove}
      onPointerUp={stopDrag} onPointerCancel={() => {clearHint(); move(); tapCase.current = null; stopDrag(); trailing.current = true;}}
      onLostPointerCapture={() => {if (drag.current) {clearHint(); move(); tapCase.current = null; stopDrag(); trailing.current = true;}}}
      onPointerLeave={() => {clearHint(); if (!drag.current && !motion.intended) offset.current = {x: 0, y: 0}; move();}}
      onClick={event => {
        const startedOnCase = tapCase.current; tapCase.current = null;
        if (trailing.current) {trailing.current = false; event.preventDefault(); event.stopPropagation(); return;}
        if (event.detail !== 0 && !startedOnCase) {
          if (ready && !scene.current?.hits(event.clientX, event.clientY)) onDismiss();
          return;
        }
        if (startedOnCase?.disc !== undefined) takeDisc(startedOnCase.disc); else toggle();
      }}>
      <canvas ref={canvas} className="album-webgl-canvas" aria-hidden="true"/>
      {!ready ? <div className="album-model-loading" role="status" aria-live="polite">
        <span className="album-model-loading-spinner" aria-hidden="true"/>
        <span>正在加载专辑模型</span>
      </div> : null}
      <span className="album-model-status" role="status">{discStatus}</span>
    </div>
  </div>;
}
