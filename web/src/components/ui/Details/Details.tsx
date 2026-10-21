// Details：带平滑展开 / 收起的 <details>（键盘与读屏仍用原生语义）。
// 原生 details 开合是瞬间的；这里点击 summary 时接管：展开 = 先置 open 再把内容高度从 0 动画到实际高度，
// 收起 = 保持 open 把高度动画到 0 再摘掉 open。箭头始终是全站唯一的 Chevron，随逻辑状态旋转。
// 受控用法：传 open / onOpenChange；非受控用 defaultOpen。减少动态效果下直接切换。
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {MouseEvent, ReactNode} from 'react';
import {Chevron} from '../Chevron';
import './Details.css';

export interface DetailsProps {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MS = 280;
const EASE = 'cubic-bezier(.2,.8,.3,1)';

export function Details({summary, children, className = '', open, defaultOpen = false, onOpenChange}: DetailsProps) {
  const [isOpen, setIsOpen] = useState(open ?? defaultOpen);
  const [closing, setClosing] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => { if (open !== undefined) setIsOpen(open); }, [open]);

  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    const el = body.current;
    let reduce = true;
    try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* 当作减少动态 */ }
    if (!el || reduce || typeof el.animate !== 'function') { setClosing(false); return; }
    const full = el.scrollHeight;
    el.style.overflow = 'hidden';
    const frames = isOpen
      ? [{height: '0px', opacity: 0}, {height: `${full}px`, opacity: 1}]
      : [{height: `${full}px`, opacity: 1}, {height: '0px', opacity: 0}];
    const anim = el.animate(frames, {duration: MS, easing: EASE});
    anim.finished.catch(() => undefined).then(() => { el.style.overflow = ''; setClosing(false); });
    return () => { anim.cancel(); el.style.overflow = ''; };
  }, [isOpen]);

  const toggle = (event: MouseEvent) => {
    event.preventDefault();
    const next = !isOpen;
    if (!next) setClosing(true);
    setIsOpen(next);
    onOpenChange?.(next);
  };

  return (
    <details className={`details${className ? ` ${className}` : ''}`} open={isOpen || closing}>
      <summary onClick={toggle}><Chevron dir="right" open={isOpen}/>{summary}</summary>
      <div className="details-body" ref={body}>{children}</div>
    </details>
  );
}
