// 展示页巡游控件：开关按钮 + 速度胶囊。工具区与沉浸悬浮条共用同一组。
// 速度胶囊点开就地浮出 5 档分段（Seg），选中即生效、浮层不关，可一边看巡游一边调；点外面或 Esc 收起。
import {useEffect, useId, useRef, useState} from 'react';
import {GALLERY_ROAMING_PACES} from '../core/gallery';
import type {GalleryRoamingPace} from '../core/gallery';
import {Seg} from './ui/Seg';
import {Chevron} from './ui/Chevron';
import {useLeaving} from './ui/useLeaving';

const LEAVE_MS = 120;   // 与 Dropdown 浮层的退出动画一致

/** 巡游开关：与「展示设置」同款的工具栏按钮（沿用 .gallery-adjust-trigger），图标表示状态——关闭 = 播放，开启 = 暂停并用强调色 */
export function GalleryRoamingSwitch({enabled, disabled = false, onToggle}: {
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return <button type="button" className="gallery-adjust-trigger gallery-roaming-toggle" aria-pressed={enabled} aria-label="自动巡游"
    disabled={disabled} onClick={onToggle}>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      {enabled ? <path d="M3.5 2h2.2v10H3.5zM8.3 2h2.2v10H8.3z"/> : <path d="M4 2.2v9.6L11.6 7z"/>}
    </svg>巡游
  </button>;
}

const factorText = (factor: number) => `${factor}×`;

export function GalleryRoamingPacePicker({pace, onPace}: {pace: GalleryRoamingPace; onPace: (pace: GalleryRoamingPace) => void}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const leaving = useLeaving(open, LEAVE_MS);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = GALLERY_ROAMING_PACES.find(p => p.value === pace) ?? GALLERY_ROAMING_PACES[2];

  useEffect(() => {
    if (!open) return;
    const down = (event: PointerEvent) => {if (!rootRef.current?.contains(event.target as Node)) setOpen(false);};
    const key = (event: KeyboardEvent) => {
      // 捕获阶段拦下 Esc：只收起浮层，不连带退出沉浸或关闭别的层
      if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); setOpen(false);}
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    return () => {document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key, true);};
  }, [open]);

  return <div ref={rootRef} className="gallery-pace">
    <button type="button" className="gallery-pace-trigger" aria-haspopup="true" aria-expanded={open} aria-controls={`${id}-pace`}
      aria-label={`巡游速度：${current.label}`} onClick={() => setOpen(v => !v)}>
      <span>{factorText(current.factor)}</span><Chevron open={open}/>
    </button>
    {open || leaving ? <div id={`${id}-pace`} className={`gallery-pace-pop${leaving ? ' is-leaving' : ''}`}>
      <Seg ariaLabel="巡游速度" value={pace} onValue={value => onPace(value as GalleryRoamingPace)}
        options={GALLERY_ROAMING_PACES.map(p => ({value: p.value, label: p.label, title: factorText(p.factor)}))}/>
    </div> : null}
  </div>;
}
