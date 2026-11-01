// 聚焦输入层：手机上点表单里的输入框 → 不让页面去追键盘，而是在键盘正上方升起一层独立的输入面板。
// 面板挂在 body 上（不在抽屉内），自己按 visualViewport 贴住键盘上沿；背后的页面全程不动。
// 单行：回车 / 完成按钮提交；多行（multiline）：回车换行，只有完成按钮提交。点遮罩 / 取消 / Esc 收起。
// 打开时在 layout effect 里同步聚焦：调用方在点按手势内 flushSync 打开，iOS 才会弹出键盘。
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {AutoTextarea} from '../AutoTextarea';
import './FocusInput.css';

export interface FocusInputProps {
  open: boolean;
  title: string;
  value: string;
  placeholder?: string;
  submitLabel: string;
  enterKeyHint?: 'search' | 'done' | 'go' | 'next' | 'send' | 'enter';
  inputMode?: 'text' | 'numeric' | 'decimal' | 'url' | 'email' | 'tel' | 'search';
  /** 单行输入的类型（password 保持遮挡） */
  type?: 'text' | 'password' | 'url' | 'email' | 'tel' | 'search';
  multiline?: boolean;
  maxLength?: number;
  onChange: (v: string) => void;
  onSubmit: () => void;
  /** 单行时键盘回车（不传则同 onSubmit） */
  onEnter?: () => void;
  onClose: () => void;
}

export function FocusInput(p: FocusInputProps) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [vp, setVp] = useState({top: 0, bottom: 0});
  const [shown, setShown] = useState(false);
  useLayoutEffect(() => {
    if (!p.open) return;
    const el = ref.current;
    el?.focus({preventScroll: true});
    // 光标放到末尾（多行长文直接接着写）
    if (el && el.type !== 'number') { try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* 部分类型不支持选区 */ } }
  }, [p.open]);
  useEffect(() => {
    if (!p.open) {setShown(false); return;}
    const vv = window.visualViewport;
    const sync = () => {
      if (!vv) return;
      // 可视视口相对布局视口的上缘偏移 + 键盘占的高度：面板贴在可视视口底部
      setVp({top: vv.offsetTop, bottom: Math.max(0, window.innerHeight - vv.height - vv.offsetTop)});
    };
    sync();
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    const raf = requestAnimationFrame(() => setShown(true));
    return () => {cancelAnimationFrame(raf); vv?.removeEventListener('resize', sync); vv?.removeEventListener('scroll', sync);};
  }, [p.open]);
  if (!p.open) return null;
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !p.multiline && !e.nativeEvent.isComposing) {e.preventDefault(); (p.onEnter ?? p.onSubmit)();}
    else if (e.key === 'Escape') {e.stopPropagation(); p.onClose();}
  };
  const common = {placeholder: p.placeholder, value: p.value, maxLength: p.maxLength, autoComplete: 'off',
    enterKeyHint: p.multiline ? undefined : (p.enterKeyHint ?? 'search'), onKeyDown: key};
  return createPortal(
    <div className={'fi-layer' + (shown ? ' is-shown' : '')} style={{top: vp.top, bottom: vp.bottom}}>
      <div className="fi-dim" onClick={p.onClose}/>
      <div className={'fi-card' + (p.multiline ? ' is-multiline' : '')} role="dialog" aria-label={p.title}>
        <div className="fi-head"><b>{p.title}</b><button type="button" className="quiet" onClick={p.onClose}>取消</button></div>
        <div className="fi-row">
          {p.multiline
            ? <AutoTextarea ref={el => { ref.current = el; }} {...common} maxRows={8}
                            onChange={e => p.onChange(e.target.value)}/>
            : <input ref={el => { ref.current = el; }} type={p.type ?? 'text'} inputMode={p.inputMode} {...common}
                     onChange={e => p.onChange(e.target.value)}/>}
          <button type="button" className="primary" onClick={p.onSubmit}>{p.submitLabel}</button>
        </div>
      </div>
    </div>, document.body);
}
