import {useEffect, useId, useRef, useState, type KeyboardEvent} from 'react';
import {Chevron} from './ui/Chevron';

const SPEEDS = Object.freeze(Array.from({length: 29}, (_, index) => index + 2));

function validSeconds(seconds: number): number {
  return Math.max(2, Math.min(30, Math.round(Number.isFinite(seconds) ? seconds : 8)));
}

/** 巡游开关：与工具栏其它按钮同款的胶囊按钮（按下态 = 开启），不用 iOS 式拨动开关 */
export function GalleryRoamingSwitch({enabled, disabled = false, onToggle}: {
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return <button type="button" className="gallery-roaming-toggle" aria-pressed={enabled} aria-label="自动巡游"
    disabled={disabled} onClick={onToggle}>
    <i aria-hidden="true"/>巡游
  </button>;
}

export function GalleryRoamingSpeed({disabled = false, discrete = false, isometric = false, seconds, onSpeedChange}: {
  disabled?: boolean;
  discrete?: boolean;
  isometric?: boolean;
  seconds: number;
  onSpeedChange: (seconds: number) => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => validSeconds(seconds));
  const current = validSeconds(seconds);
  const title = discrete ? '切换间隔' : '巡游速度';
  const unit = discrete ? '秒' : isometric ? '秒/排' : '秒/张';
  const description = discrete ? '每张停留时间' : isometric ? '等距轨道移动一排（3 张封面）的时间' : '移动一张封面所需时间';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    const wheel = wheelRef.current;
    const row = wheel?.firstElementChild as HTMLElement | null;
    if (wheel && row) {
      wheel.scrollTop = (current - SPEEDS[0]) * row.offsetHeight;
      wheel.focus({preventScroll: true});
    }
  }, [open, current]);

  const select = (value: number) => {
    const next = validSeconds(value);
    setDraft(next);
    const wheel = wheelRef.current;
    const row = wheel?.firstElementChild as HTMLElement | null;
    if (wheel && row) wheel.scrollTo({top: (next - SPEEDS[0]) * row.offsetHeight, behavior: 'auto'});
  };

  const confirm = () => {
    onSpeedChange(draft);
    setOpen(false);
  };

  const onWheelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number | undefined;
    if (event.key === 'ArrowDown') next = draft + 1;
    if (event.key === 'ArrowUp') next = draft - 1;
    if (event.key === 'PageDown') next = draft + 5;
    if (event.key === 'PageUp') next = draft - 5;
    if (event.key === 'Home') next = SPEEDS[0];
    if (event.key === 'End') next = SPEEDS[SPEEDS.length - 1];
    if (next !== undefined) {
      event.preventDefault();
      select(next);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      confirm();
    }
  };

  return <>
    <button type="button" className="gallery-roaming-speed" aria-label={`${title}：${current} ${unit}`}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-dialog`} disabled={disabled}
      onClick={() => {setDraft(current); setOpen(true);}}>
      <span><strong>{current}</strong> {unit}</span>
      <Chevron/>
    </button>
    <dialog ref={dialogRef} id={`${id}-dialog`} className="gallery-speed-picker"
      aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={event => {event.preventDefault(); setOpen(false);}}
      onClose={() => setOpen(false)}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOpen(false);
      }}>
      <div className="gallery-speed-picker-head">
        <button type="button" className="gallery-speed-picker-cancel" aria-label="取消巡游速度设置" onClick={() => setOpen(false)}>×</button>
        <h3 id={`${id}-title`}>{title}</h3>
        <button type="button" className="gallery-speed-picker-confirm" aria-label="确认巡游速度" onClick={confirm}>✓</button>
      </div>
      <p id={`${id}-description`} className="gallery-speed-picker-description">{description}</p>
      <div className="gallery-speed-wheel-frame">
        <div className="gallery-speed-wheel-band" aria-hidden="true" />
        <div ref={wheelRef} className="gallery-speed-wheel" role="listbox" tabIndex={0}
          aria-label={description} aria-activedescendant={`${id}-seconds-${draft}`}
          onKeyDown={onWheelKeyDown}
          onScroll={event => {
            const wheel = event.currentTarget;
            const row = wheel.firstElementChild as HTMLElement | null;
            if (row?.offsetHeight) setDraft(validSeconds(SPEEDS[0] + Math.round(wheel.scrollTop / row.offsetHeight)));
          }}>
          {SPEEDS.map(value => {
            const distance = Math.abs(value - draft);
            const className = distance === 0 ? 'is-selected' : distance === 1 ? 'is-near' : 'is-far';
            return <div key={value} id={`${id}-seconds-${value}`} className={`gallery-speed-wheel-option ${className}`}
              role="option" aria-selected={value === draft} aria-label={`${value} 秒`} onClick={() => select(value)}>
              {String(value).padStart(2, '0')}
            </div>;
          })}
        </div>
        <span className="gallery-speed-wheel-unit" aria-hidden="true">{unit}</span>
      </div>
      <p className="gallery-speed-picker-hint">{discrete ? '滑动选择 · 每次切换前停留' : '滑动选择 · 数值越小越快'}</p>
    </dialog>
  </>;
}
