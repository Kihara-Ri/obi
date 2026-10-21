// Dropdown：自定义下拉选择（排序 / 筛选 / 表单选项）。受控：value + onPick。
// 不用原生 <select> 以保持视觉一致；按钮 + 浮层（listbox），可访问名称为「label：当前值」。
// 键盘：↑↓ 移动高亮（aria-activedescendant）、Home/End、Enter/Space 选中、Esc 关闭
//   （并阻止冒泡，避免连带关闭外层抽屉）、字母键按首字跳转、Tab 离开即关。
// 外部点击/触摸：监听 document 的 pointerdown——Safari（含 iOS）点按钮不会让它聚焦，
//   单靠 blur 关不掉浮层。
// 浮层靠近视口底部、且上方更宽裕时向上展开。
import {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import type {KeyboardEvent} from 'react';
import {Chevron} from '../Chevron';
import {useLeaving} from '../useLeaving';
import './Dropdown.css';

export interface DdOption {
  value: string;
  label: string;
  /** 不可选：灰显、键盘跳过 */
  disabled?: boolean;
}

export interface DropdownProps {
  /** DOM id 前缀；省略时自动生成 */
  id?: string;
  value: string;
  options: DdOption[];
  /** 控件名称（读屏朗读为「label：当前值」） */
  label: string;
  onPick: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const TYPEAHEAD_MS = 700;
const LEAVE_MS = 120;   // 与 Dropdown.css 的退出动画时长一致

export function Dropdown({id, value, options, label, onPick, className = '', disabled = false}: DropdownProps) {
  const auto = useId();
  const uid = id || auto;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [keyNav, setKeyNav] = useState(false);   // 键盘导航中：高亮跟随 active 而非当前值
  const [up, setUp] = useState(false);
  const leaving = useLeaving(open, LEAVE_MS);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({text: '', timer: 0});
  const swallowSpace = useRef(false);
  const cur = options.find(o => o.value === value) ?? options[0];
  const optId = (i: number) => `${uid}-opt-${i}`;

  const enabledIdx = () => options.flatMap((o, i) => (o.disabled ? [] : [i]));
  const close = () => { setOpen(false); setActive(-1); setKeyNav(false); };
  const openList = (at?: number) => {
    const sel = options.findIndex(o => o.value === cur?.value && !o.disabled);
    setActive(at ?? (sel >= 0 ? sel : (enabledIdx()[0] ?? -1)));
    setKeyNav(at !== undefined);
    setOpen(true);
  };
  const choose = (o: DdOption) => {
    if (o.disabled) return;
    onPick(o.value);
    close();
  };
  const move = (dir: 1 | -1) => {
    const en = enabledIdx();
    if (!en.length) return;
    const pos = en.indexOf(active);
    setActive(pos < 0 ? (dir > 0 ? en[0] : en[en.length - 1]) : en[(pos + dir + en.length) % en.length]);
  };

  // 向上展开：浮层放不下底部、且上方空间更大
  useLayoutEffect(() => {
    if (!open) return;   // 退出动画期间保持原展开方向
    const list = listRef.current;
    const root = rootRef.current;
    if (!list || !root) return;
    const box = root.getBoundingClientRect();
    const below = window.innerHeight - box.bottom - 8;
    setUp(list.offsetHeight > below && box.top - 8 > below);
  }, [open]);

  // 键盘高亮项滚动进视野
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

  useEffect(() => () => window.clearTimeout(typed.current.timer), []);

  const typeahead = (key: string) => {
    window.clearTimeout(typed.current.timer);
    typed.current.text += key.toLowerCase();
    typed.current.timer = window.setTimeout(() => { typed.current.text = ''; }, TYPEAHEAD_MS);
    const hit = options.findIndex(o => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text));
    if (hit < 0) return;
    if (open) { setActive(hit); setKeyNav(true); } else openList(hit);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'Escape':
        if (open) { e.preventDefault(); e.stopPropagation(); close(); }
        return;
      case 'Tab':
        close();
        return;
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        if (!open) { openList(); return; }
        setKeyNav(true);
        move(e.key === 'ArrowDown' ? 1 : -1);
        return;
      case 'Home':
      case 'End': {
        if (!open) return;
        e.preventDefault();
        const en = enabledIdx();
        setKeyNav(true);
        setActive(e.key === 'Home' ? en[0] : en[en.length - 1]);
        return;
      }
      case 'Enter':
      case ' ':
        if (open && active >= 0) {
          e.preventDefault();
          if (e.key === ' ') swallowSpace.current = true;   // 吞掉随后的 keyup 点击，免得又把浮层打开
          choose(options[active]);
        }
        return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeahead(e.key);
    }
  };

  return (
    <div className={`dd${className ? ` ${className}` : ''}`} ref={rootRef} onKeyDown={onKeyDown}
         onKeyUp={e => { if (e.key === ' ' && swallowSpace.current) { e.preventDefault(); swallowSpace.current = false; } }}
         onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) close(); }}>
      <button type="button" className="dd-btn" role="combobox" aria-haspopup="listbox"
              aria-expanded={open} aria-controls={`${uid}-list`}
              aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
              aria-label={`${label}：${cur?.label ?? ''}`} disabled={disabled}
              onClick={() => (open ? close() : openList())}>
        <span className="dd-label">{cur?.label}</span>
        <Chevron open={open}/>
      </button>
      <div className={`dd-list${up ? ' dd-list--up' : ''}${leaving ? ' is-leaving' : ''}`} id={`${uid}-list`} role="listbox" aria-label={label}
           data-nav={keyNav ? 'key' : undefined} hidden={!open && !leaving} ref={listRef}>
        {options.map((o, i) => (
          <div key={o.value} id={optId(i)} role="option" aria-selected={o.value === cur?.value}
               aria-disabled={o.disabled || undefined}
               className={`dd-opt${i === active ? ' is-active' : ''}`}
               onPointerDown={e => e.preventDefault()}
               onPointerMove={() => { if (!o.disabled && (active !== i || keyNav)) { setActive(i); setKeyNav(false); } }}
               onClick={() => choose(o)}>{o.label}</div>
        ))}
      </div>
    </div>
  );
}
