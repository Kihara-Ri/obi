// 左滑露出操作的列表行（手机）：手指横向拖动内容层，松手过半就停在展开位置，露出右侧操作按钮。
// 只接管触摸（鼠标 / 触控笔不触发）；竖向滚动交给浏览器（touch-action: pan-y）。
// 同一时间只展开一行：展开另一行、点行外任何地方、点内容层本身都会收回；点了操作按钮也先收回再执行。
// 外层就是行元素本身（className / data-* 原样透传），收起时不裁切，外部给行做的 FLIP 动画不受影响。
import {useEffect, useRef, useState} from 'react';
import type {HTMLAttributes, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent, ReactNode} from 'react';
import './SwipeRow.css';

export interface SwipeAction {
  label: string;
  onClick: () => void;
  /** primary = 主色实底；默认中性底 */
  tone?: 'primary' | 'plain';
  ariaLabel?: string;
}

export interface SwipeRowProps extends HTMLAttributes<HTMLElement> {
  actions: SwipeAction[];
  /** 选择模式等场景下停用手势（已展开的会收回） */
  disabled?: boolean;
  as?: 'div' | 'article' | 'li';
  /** 为 true 时（手机、未要求减少动画）稍后自动左滑一下再收回，演示这个手势；开始播放时调用 onHintShown */
  hint?: boolean;
  onHintShown?: () => void;
  children: ReactNode;
}

/** 每个操作按钮的宽度（px），与 SwipeRow.css 的 --swipe-btn 一致 */
const BTN = 76;
const LOCK = 8;   // 判定方向前允许的抖动
let openRow: {close: () => void} | null = null;

export function SwipeRow({actions, disabled, as = 'div', hint, onHintShown, className, children, ...rest}: SwipeRowProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const [peek, setPeek] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const anim = useRef<Animation | null>(null);
  const me = useRef({close: () => setDx(0)}).current;
  const g = useRef({id: -1, x: 0, y: 0, base: 0, lock: '' as '' | 'x' | 'y', moved: false, last: 0});
  const max = actions.length * BTN;
  const open = dx !== 0 && !drag;

  useEffect(() => { if (disabled) setDx(0); }, [disabled]);
  // 手势演示：延迟一下（等页面切换动画结束）再滑开 60% 停一停、收回。hint 变化只取消还没开始的那次，已开始的播完
  useEffect(() => {
    if (!hint || disabled || !actions.length) return;
    let ok = false;
    try { ok = matchMedia('(max-width:840px)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* 无 matchMedia */ }
    if (!ok) return;
    const timer = setTimeout(() => {
      const el = content.current;
      if (!el?.animate) return;
      const x = `translateX(${-Math.round(max * .6)}px)`;
      setPeek(true);
      anim.current = el.animate([{transform: 'none'}, {transform: x, offset: .35}, {transform: x, offset: .65}, {transform: 'none'}],
        {duration: 1400, easing: 'ease-in-out'});
      anim.current.onfinish = anim.current.oncancel = () => setPeek(false);
      onHintShown?.();
    }, 900);
    return () => clearTimeout(timer);
  }, [hint, disabled, actions.length, max, onHintShown]);
  useEffect(() => () => anim.current?.cancel(), []);
  useEffect(() => {
    if (!open) return;
    if (openRow && openRow !== me) openRow.close();
    openRow = me;
    const outside = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setDx(0); };
    document.addEventListener('pointerdown', outside, true);
    return () => { document.removeEventListener('pointerdown', outside, true); if (openRow === me) openRow = null; };
  }, [open, me]);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    anim.current?.cancel();
    if (disabled || !actions.length || e.pointerType !== 'touch') return;
    g.current = {id: e.pointerId, x: e.clientX, y: e.clientY, base: dx, lock: '', moved: false, last: dx};
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = g.current;
    if (s.id !== e.pointerId || s.lock === 'y') return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (!s.lock) {
      if (Math.abs(mx) > LOCK && Math.abs(mx) > Math.abs(my)) {
        s.lock = 'x'; setDrag(true);
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 指针已结束 */ }
      } else if (Math.abs(my) > LOCK) { s.lock = 'y'; return; } else return;
    }
    s.moved = true;
    let next = s.base + mx;
    // 超出展开宽度或向右拖过头时加阻尼
    if (next < -max) next = -max + (next + max) / 3;
    if (next > 0) next = next / 3;
    s.last = next;
    setDx(next);
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = g.current;
    if (s.id !== e.pointerId) return;
    s.id = -1;
    if (s.lock !== 'x') return;
    setDrag(false);
    setDx(s.last < -max / 2 ? -max : 0);
  };
  // 拖动结束时的那次 click 不算点按；已展开时点内容层只收回，不进详情
  const clickCapture = (e: ReactMouseEvent) => {
    if (g.current.moved || dx !== 0) {
      e.preventDefault(); e.stopPropagation();
      g.current.moved = false;
      if (!drag) setDx(0);
    }
  };

  const Tag = as;
  const cls = ['swipe-row', className, dx !== 0 || drag || peek ? 'is-swiped' : '', drag ? 'is-dragging' : ''].filter(Boolean).join(' ');
  return (
    <Tag ref={(el: HTMLElement | null) => { ref.current = el; }} className={cls} {...rest}>
      {actions.length ? <div className="swipe-actions" aria-hidden={!open || undefined}>
        {actions.map(a => (
          <button key={a.label} type="button" className={`swipe-action tone-${a.tone ?? 'plain'}`} tabIndex={open ? 0 : -1}
                  aria-label={a.ariaLabel} onClick={() => { setDx(0); a.onClick(); }}>{a.label}</button>
        ))}
      </div> : null}
      <div ref={content} className="swipe-content" style={dx ? {transform: `translateX(${dx}px)`} : undefined}
           onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClickCapture={clickCapture}>
        {children}
      </div>
    </Tag>
  );
}
