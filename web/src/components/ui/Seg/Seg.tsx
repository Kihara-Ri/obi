// Seg：iOS 式分段控件，滑块随选中项左右滑动。受控：value + onValue。
// 语义：role=group + 每段 aria-pressed（读屏可知选中项）；纯图标的段用 ariaLabel 命名。
// 键盘：Tab 进入后 ←→/↑↓ 在可用段之间移动焦点，Home/End 跳首尾，Enter/Space 选中。
// 滑块由 useSlidingThumb 驱动（与标签页下划线共用）；persistKey 让跨页面重挂后仍有滑动动画。
import {useRef} from 'react';
import type {KeyboardEvent, ReactNode} from 'react';
import {useSlidingThumb} from '../SlidingThumb';
import './Seg.css';

export interface SegOption {
  value: string;
  label: ReactNode;
  /** 选项内容为纯图标时提供可访问名称 */
  ariaLabel?: string;
  /** 悬停提示（纯图标的段建议提供） */
  title?: string;
  disabled?: boolean;
}

export interface SegProps {
  options: SegOption[];
  value: string;
  onValue: (value: string) => void;
  className?: string;
  /** 整组的可访问名称 */
  ariaLabel?: string;
  disabled?: boolean;
  /** 页面切换会卸载重挂本控件时，用同一个键让滑块从上次位置滑到新位置（见 useSlidingThumb） */
  persistKey?: string;
}

export function Seg({options, value, onValue, className = '', ariaLabel, disabled = false, persistKey}: SegProps) {
  const ref = useRef<HTMLDivElement>(null);
  useSlidingThumb(ref, {thumb: '.seg-thumb', active: 'button.on', persistKey});

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0
      : e.key === 'End' ? buttons.length - 1
        : (at + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <div className={`seg ${className}`.trim()} ref={ref} role="group" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      <span className="seg-thumb" aria-hidden="true"/>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={o.value === value}
                aria-label={o.ariaLabel} title={o.title} disabled={disabled || o.disabled}
                className={o.value === value ? 'on' : ''} onClick={() => onValue(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
