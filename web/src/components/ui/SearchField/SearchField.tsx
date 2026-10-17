// SearchField：搜索框。受控：value + onChange。左侧放大镜，有内容时右侧出现清除按钮；
// 输入框内按 Esc 清空（已空则放行给外层，例如关闭抽屉）。
// 外层沿用 .search（工具栏里的布局由 .toolbar .search 控制），本组件只负责框内的交互。
import type {KeyboardEvent} from 'react';
import './SearchField.css';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** 输入框的可访问名称 */
  ariaLabel: string;
  id?: string;
  className?: string;
}

export function SearchField({value, onChange, placeholder, ariaLabel, id, className = ''}: SearchFieldProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && value) { e.preventDefault(); e.stopPropagation(); onChange(''); }
  };
  return (
    <div className={`search${value ? ' has-value' : ''}${className ? ` ${className}` : ''}`}>
      <input id={id} aria-label={ariaLabel} placeholder={placeholder} value={value}
             enterKeyHint="search" autoComplete="off" onKeyDown={onKeyDown}
             onChange={e => onChange(e.target.value)}/>
      {value ? <button type="button" className="search-clear" aria-label="清除搜索"
                       onClick={e => { onChange(''); e.currentTarget.parentElement?.querySelector('input')?.focus(); }}>×</button> : null}
    </div>
  );
}
