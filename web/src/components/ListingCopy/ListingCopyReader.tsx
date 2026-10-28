// 长文阅读层不进入文档流；背景保留占位并 inert，底部复制/图片操作仍可用。
import {useCallback, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {ListingDraft} from '../../core/listing';

type Props = {host: HTMLElement; origin: HTMLElement; draft: ListingDraft; saved: boolean; candidate: boolean;
  id: string; onClose: () => void};
export function ListingCopyReader({host, origin, draft, saved, candidate, id, onClose}: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const animation = useRef<Animation | null>(null);
  const closing = useRef(false);
  const [frame, setFrame] = useState(() => measure(host, origin));
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const element = panel.current;
    if (!element || reduce()) {onClose(); return;}
    // 从当前裁剪位置接着淡出，不先把阅读滚动归零；原摘要一直留在原处。
    const style = getComputedStyle(element);
    const clip = style.clipPath;
    const opacity = style.opacity;
    animation.current?.cancel();
    const fading = element.animate([{clipPath: clip, opacity}, {clipPath: clip, opacity: 0}],
      {duration: milliseconds(style.getPropertyValue('--dur-fast')), easing: style.getPropertyValue('--ease-out').trim(), fill: 'forwards'});
    animation.current = fading;
    void fading.finished.then(onClose, () => undefined);
  }, [onClose]);
  useLayoutEffect(() => {
    const background = host.querySelector<HTMLElement>('.listing-body');
    const active = document.activeElement;
    const wasInert = background?.inert ?? false;
    if (background) background.inert = true;
    closeButton.current?.focus({preventScroll: true});
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopImmediatePropagation(); close();
    };
    const wheel = (event: WheelEvent) => {
      if (!panel.current?.contains(event.target as Node)) event.preventDefault();
    };
    window.addEventListener('keydown', key, true);
    host.addEventListener('wheel', wheel, {passive: false});
    const observer = new ResizeObserver(() => setFrame(measure(host, origin)));
    observer.observe(host);
    const element = panel.current;
    if (element && !reduce()) {
      const style = getComputedStyle(element);
      const cut = Math.max(0, element.clientHeight - origin.offsetHeight);
      animation.current = element.animate([{clipPath: `inset(0 0 ${cut}px 0)`}, {clipPath: 'inset(0)'}],
        {duration: milliseconds(style.getPropertyValue('--dur')), easing: style.getPropertyValue('--ease-out').trim(), fill: 'backwards'});
    }
    return () => {
      observer.disconnect(); animation.current?.cancel();
      window.removeEventListener('keydown', key, true); host.removeEventListener('wheel', wheel);
      if (background) background.inert = wasInert;
      if (active instanceof HTMLElement && active.isConnected && host.isConnected) active.focus({preventScroll: true});
    };
  }, [host, origin, close]);
  return createPortal(<div className="listing-copy-reader" id={id} ref={panel} role="region" aria-label="文案全文"
    style={{top: frame.top, left: frame.left, width: frame.width}}>
    <header className="listing-copy-head"><h4>售卖文案{saved && !candidate ? ' · 已保存' : ''}</h4>
      <div className="listing-copy-tools"><button type="button" ref={closeButton} onClick={close} aria-expanded="true" aria-controls={id}>收起全文</button></div>
    </header>
    <div className="listing-copy-reader-scroll" tabIndex={0} aria-label="完整文案内容">
      {candidate ? <p className="listing-copy-status">新文案 · 原稿已保留</p> : null}
      <div className="listing-copy-text"><h3>{draft.title}</h3><p>{draft.description}</p></div>
    </div>
  </div>, host);
}

function measure(host: HTMLElement, origin: HTMLElement) {
  const outer = host.getBoundingClientRect(), box = origin.getBoundingClientRect();
  return {top: Math.max(0, box.top - outer.top), left: box.left - outer.left, width: box.width};
}

function milliseconds(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed * (value.trim().endsWith('ms') ? 1 : 1000) : 0;
}
