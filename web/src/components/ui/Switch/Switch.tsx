// Switch：开关。受控：on + onToggle。
// 语义：role=switch + aria-checked；没有可见文字标签时必须传 label 作为可访问名称。
// 触控：视觉 46×28，命中区向外扩（见 Switch.css），手机上不易误触旁边内容。
import './Switch.css';

export interface SwitchProps {
  on: boolean;
  onToggle: () => void;
  /** 可访问名称（旁边没有可见标签时必填） */
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({on, onToggle, label, disabled = false, className = ''}: SwitchProps) {
  return (
    <button type="button" className={`switch${on ? ' on' : ''}${className ? ` ${className}` : ''}`}
            role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onToggle}>
      <span className="knob"/>
    </button>
  );
}
