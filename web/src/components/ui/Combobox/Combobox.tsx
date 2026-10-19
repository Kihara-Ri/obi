// Combobox：可输入 + 可下拉选择的组合框（输入即过滤，也可自由输入列表之外的新值）。
// 受控：value 是输入框里的文字，onChange 在输入或选中时都会触发。
// 行为：聚焦 / 点击 / 输入 / ↓ 打开；↑↓ 移动高亮（aria-activedescendant）、Enter 选中高亮项、
//   Esc 关闭（阻止冒泡，避免连带关闭外层抽屉）、Tab 离开即关；点到组件外（含触屏）即关。
// 打开时先展示全部选项；开始输入后按「label 包含输入」过滤。
// 每个选项可带 leading（图标/标记），输入框左侧可放 leading 元素。
import {useEffect, useId, useMemo, useRef, useState} from 'react';
import type {KeyboardEvent, ReactNode} from 'react';
import {ChevDownIco} from '../../icons';
import {useLeaving} from '../useLeaving';
import './Combobox.css';

export interface ComboOption {
  value: string;
  label: string;
  /** 选项左侧的图标或标记 */
  leading?: ReactNode;
}

export interface ComboboxProps {
  /** 输入框 id（配合外部 <label htmlFor>）；浮层 id 由它派生 */
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  /** 浮层的可访问名称 */
  listLabel: string;
  /** 右侧展开按钮的可访问名称 */
  toggleLabel?: string;
  /** 输入框左侧的图标或标记 */
  leading?: ReactNode;
  /** 无匹配选项时的提示 */
  emptyHint?: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Combobox({
  id, value, onChange, options, placeholder, listLabel, toggleLabel = '展开选项',
  leading, emptyHint, className = '', disabled = false,
}: ComboboxProps) {
  const auto = useId();
  const uid = id || auto;
  const listId = `${uid}-list`;
  const [open, setOpen] = useState(false);
  const leaving = useLeaving(open, 120);   // 与 Combobox.css 的退出动画时长一致
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = filter.toLocaleLowerCase();
    return options.filter(o => o.label.toLocaleLowerCase().includes(q));
  }, [options, filter]);

  const show = (q = '') => { setFilter(q); setActive(-1); setOpen(true); };
  const close = () => { setOpen(false); setActive(-1); };
  const choose = (o: ComboOption) => { onChange(o.label); close(); };

  useEffect(() => {
    if (open && active >= 0) listRef.current?.children[active]?.scrollIntoView({block: 'nearest'});
  }, [active, open]);

  // 点到组件外（含触屏）即关
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'Tab') { close(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { show(); return; }
      if (!matches.length) return;
      setActive(a => (a < 0 ? (e.key === 'ArrowDown' ? 0 : matches.length - 1)
        : (a + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length));
    } else if (e.key === 'Enter' && open && active >= 0) {
      e.preventDefault();
      choose(matches[active]);
    }
  };

  return (
    <div className={`cb${className ? ` ${className}` : ''}`} ref={rootRef}
         onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) close(); }}>
      <div className={`cb-control${leading ? ' has-leading' : ''}`}>
        {leading ? <span className="cb-leading" aria-hidden="true">{leading}</span> : null}
        <input id={uid} value={value} role="combobox" aria-autocomplete="list" aria-expanded={open}
               aria-controls={listId} aria-activedescendant={open && active >= 0 ? `${uid}-opt-${active}` : undefined}
               autoComplete="off" placeholder={placeholder} disabled={disabled}
               onChange={e => { onChange(e.target.value); show(e.target.value); }}
               onFocus={() => show()}
               onClick={() => { if (!open) show(); }}
               onKeyDown={onKeyDown}/>
        <button type="button" className="cb-toggle" aria-label={toggleLabel} disabled={disabled}
                onClick={() => { if (open) close(); else show(); }}>{ChevDownIco}</button>
      </div>
      <div id={listId} className={leaving ? 'cb-list is-leaving' : 'cb-list'} role="listbox" aria-label={listLabel} hidden={!open && !leaving} ref={listRef}>
        {matches.map((o, i) => (
          <div key={o.value} id={`${uid}-opt-${i}`} role="option" aria-selected={i === active}
               className="cb-opt" onPointerDown={e => e.preventDefault()} onClick={() => choose(o)}>
            {o.leading ? <span className="cb-opt-lead">{o.leading}</span> : null}
            <span>{o.label}</span>
          </div>
        ))}
        {!matches.length && emptyHint ? <p className="cb-empty">{emptyHint}</p> : null}
      </div>
    </div>
  );
}
