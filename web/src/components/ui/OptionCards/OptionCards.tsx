// OptionCards：带图标的互斥选项卡（图标在上、文字在下，选中描边 + 底色）。受控：value + onValue。
// 用于「选项本身可以画出来」的设置（排序、大小、方向）；纯文字的短选项仍用 Seg。
// 语义：role=radiogroup + 每张 role=radio；←→↑↓ 在选项间移动并选中（与原生单选组一致）。
import type {KeyboardEvent, ReactNode} from 'react';
import './OptionCards.css';

export interface OptionCard {value: string; label: string; icon: ReactNode}

export interface OptionCardsProps {
  options: OptionCard[];
  value: string;
  onValue: (value: string) => void;
  ariaLabel: string;
  className?: string;
  /** 每行几张；默认全部排一行（选项多时用它折行）。 */
  columns?: number;
}

export function OptionCards({options, value, onValue, ariaLabel, className = '', columns}: OptionCardsProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key];
    if (!step) return;
    e.preventDefault();
    const group = e.currentTarget;
    const at = options.findIndex(o => o.value === value);
    onValue(options[(at + step + options.length) % options.length].value);
    requestAnimationFrame(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };
  return (
    <div className={`option-cards${className ? ` ${className}` : ''}`} role="radiogroup" aria-label={ariaLabel}
         style={{gridTemplateColumns: `repeat(${columns ?? options.length},minmax(0,1fr))`}} onKeyDown={onKeyDown}>
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value}
                tabIndex={o.value === value ? 0 : -1} onClick={() => onValue(o.value)}>
          <span className="option-cards-icon">{o.icon}</span>
          <span className="option-cards-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
