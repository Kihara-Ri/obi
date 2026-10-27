// 等距封面墙：三条错列沿斜向轨道连续浏览，一直首尾循环；当前封面抬起，四边渐隐。
import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {GalleryStageProps} from './GalleryStage';
import {galleryIndex, GALLERY_ROAMING_DEFAULTS} from '../core/gallery';
import {GalleryCase} from './GalleryCase';
import {StageControls, stageKey} from './GalleryStageControls';
import {useGalleryMotion} from './useGalleryMotion';
import {galleryIsometricSlots, wrapGalleryPosition} from '../core/gallery-motion';

const ISO_POSE_EXTENT = 16;

/** 三条错列组成连续等距墙；只保留附近行，小数位置不吸附。最靠近当前位置的那张略微抬起，箭头中间显示序号。 */
export function GalleryIsometric({records, currentId, density, roaming = false, roamingSpeed = GALLERY_ROAMING_DEFAULTS.isometric, onPick, onFocus}: GalleryStageProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const gestureArea = useRef<HTMLDivElement>(null);
  const index = galleryIndex(records, currentId);
  const [center, setCenter] = useState(Math.floor(index / 3));
  const centerRef = useRef(Math.floor(index / 3));
  const [nearest, setNearest] = useState(index);
  const nearestRef = useRef(index);
  const [radius, setRadius] = useState(4);
  const axisStep = useRef(140);
  const geometry = useRef({width: 320, height: 326, size: 100});
  const poses = useRef(new Map<number, {row: number; lane: number; animation: Animation; node: HTMLElement; button: HTMLButtonElement | null}>());
  const scopeKey = useMemo(() => JSON.stringify(records.map(r => r.id)), [records]);

  const paint = (position: number) => {
    const current = Math.round(position);
    poses.current.forEach((pose, slot) => {
      pose.node.classList.toggle('is-current', slot === current);
      const rowOffset = pose.row - position / 3;
      pose.animation.currentTime = Math.max(0, Math.min(ISO_POSE_EXTENT * 2, rowOffset + ISO_POSE_EXTENT)) * 1000;
      const {width, height, size} = geometry.current;
      const stagger = pose.lane === 1 ? .5 : 0;
      const cross = (pose.lane - 1) * size * .82;
      const x = (rowOffset + stagger) * axisStep.current + cross;
      const y = (rowOffset + stagger) * axisStep.current - cross;
      const visible = Math.abs(x) < width * .5 + size * .75 && Math.abs(y) < height * .5 + size * .7;
      if (pose.button) pose.button.tabIndex = visible ? 0 : -1;
      if (visible) pose.node.removeAttribute('aria-hidden');
      else {
        if (pose.button === document.activeElement) viewport.current?.closest<HTMLElement>('.gallery-stage')?.focus({preventScroll: true});
        pose.node.setAttribute('aria-hidden', 'true');
      }
    });
  };
  const motion = useGalleryMotion({
    position: index, min: 0, max: Math.max(0, records.length - 1), snap: false, scopeKey,
    loopCount: records.length, autoRun: roaming && records.length > 1,
    // 每排有三张唱片：UI 使用秒/排，位移按三张/排换算。
    autoVelocity: () => 3 / roamingSpeed,
    project: (start, point, startPosition) => startPosition - ((point.x - start.x) + (point.y - start.y)) * 3 / (axisStep.current * 2),
    onFrame: position => {
      paint(position);
      const nextCenter = Math.floor(position / 3);
      if (nextCenter !== centerRef.current) {centerRef.current = nextCenter; setCenter(nextCenter);}
      const nextNearest = wrapGalleryPosition(Math.round(position), records.length);
      if (nextNearest !== nearestRef.current) {nearestRef.current = nextNearest; setNearest(nextNearest);}
    },
    onCommit: position => {const record = records[wrapGalleryPosition(Math.round(position), records.length)]; if (record && record.id !== currentId) onPick(record.id);},
    onDragStart: () => viewport.current?.setAttribute('data-dragging', 'true'),
    onDragEnd: () => viewport.current?.removeAttribute('data-dragging'),
  });
  const slots = useMemo(() => galleryIsometricSlots(center * 3, records.length, radius), [center, records.length, radius]);

  useLayoutEffect(() => {
    const area = viewport.current;
    if (!area) return;
    const measure = () => {
      const item = area.querySelector<HTMLElement>('.gallery-isometric-item');
      const size = item ? parseFloat(getComputedStyle(item).width) : 150;
      axisStep.current = Math.max(1, size * .94);
      const width = gestureArea.current?.clientWidth || area.clientWidth;
      geometry.current = {width, height: area.clientHeight, size};
      setRadius(Math.max(2, Math.min(6, Math.ceil(Math.min(width, area.clientHeight) / (axisStep.current * 2) + 2.7))));
      paint(motion.positionRef.current);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, [scopeKey, density]);
  // 新进入缓冲区的封面在浏览器绘制前就取得正确的暂停动画位置。
  useLayoutEffect(() => {paint(motion.positionRef.current);}, [slots, records, density]);

  const step = (by: number) => motion.moveTo(motion.positionRef.current + by);
  // 拖后点击由 rail capture 消费；键盘生成的 click 仍正常打开。
  const open = (id: string, source: HTMLElement) => {motion.stop(false); onFocus(id, source);};
  return <div className={`gallery-stage gallery-stage--isometric gallery-density--${density}`} tabIndex={0}
    role="region" aria-label="等距封面墙，沿左上和右下拖动连续浏览" onKeyDown={event => stageKey(event, step)}>
    <div className="gallery-isometric-shell">
      <div ref={viewport} className="gallery-isometric-viewport" {...motion.handlers} onDragStart={event => event.preventDefault()}
        onPointerDown={event => {
          motion.handlers.onPointerDown(event);
          if (event.isPrimary && !gestureArea.current?.contains(event.target as Node)) motion.stop();
        }}>
        <div ref={gestureArea} className="gallery-isometric-gesture">
        {slots.map(({slot, row, lane, recordIndex}) => {
          const record = records[recordIndex];
          return <div key={slot} className={`gallery-isometric-item gallery-isometric-lane--${lane}`} data-motion-index={slot}
          ref={node => {
            if (!node) {poses.current.delete(slot); return;}
            const animation = node.getAnimations().find(a => (a as CSSAnimation).animationName === 'gallery-isometric-position');
            if (animation) {
              animation.pause();
              poses.current.set(slot, {row, lane, animation, node, button: node.querySelector('button')});
              animation.currentTime = (row - motion.positionRef.current / 3 + ISO_POSE_EXTENT) * 1000;
            }
          }}>
          <button type="button" className="gallery-cover-button gallery-continuous-cover gallery-case-button"
            data-gallery-record-id={record.id}
            aria-label={`查看封面：${record.title} · ${record.artist}`} title={record.title} onClick={event => open(record.id, event.currentTarget)}>
            <GalleryCase record={record} spatial/>
          </button>
        </div>;
        })}
        </div>
      </div>
      <StageControls index={nearest} count={records.length} start={false} end={false} step={step}/>
    </div>
    <span className="gallery-visually-hidden" aria-live={roaming ? 'off' : 'polite'} aria-atomic="true">
      {roaming ? '正在缓慢循环巡游' : '可沿斜向轨道循环浏览'}，当前范围共 {records.length} 张
    </span>
  </div>;
}
