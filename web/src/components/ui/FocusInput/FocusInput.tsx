// 聚焦输入层：手机上点表单里的输入框 → 不让页面去追键盘，而是在键盘正上方升起一层独立的输入面板。
// 面板挂在 body 上（不在抽屉内，抽屉的滚动 / 键盘避让逻辑碰不到它），自己按 visualViewport 贴住键盘上沿；
// 背后的页面全程不动。提交（回车 / 按钮）或点遮罩 / 取消 / Esc 收起。
import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import './FocusInput.css';

export interface FocusInputProps {
  open: boolean;
  title: string;
  value: string;
  placeholder?: string;
  submitLabel: string;
  enterKeyHint?: 'search' | 'done' | 'go';
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function FocusInput(p: FocusInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [vp, setVp] = useState({top: 0, bottom: 0});
  const [shown, setShown] = useState(false);
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
    ref.current?.focus({preventScroll: true});
    const raf = requestAnimationFrame(() => setShown(true));
    return () => {cancelAnimationFrame(raf); vv?.removeEventListener('resize', sync); vv?.removeEventListener('scroll', sync);};
  }, [p.open]);
  if (!p.open) return null;
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {e.preventDefault(); p.onSubmit();}
    else if (e.key === 'Escape') {e.stopPropagation(); p.onClose();}
  };
  return createPortal(
    <div className={'fi-layer' + (shown ? ' is-shown' : '')} style={{top: vp.top, bottom: vp.bottom}}>
      <div className="fi-dim" onClick={p.onClose}/>
      <div className="fi-card" role="dialog" aria-label={p.title}>
        <div className="fi-head"><b>{p.title}</b><button type="button" className="quiet" onClick={p.onClose}>取消</button></div>
        <div className="fi-row">
          <input ref={ref} type="text" autoComplete="off" enterKeyHint={p.enterKeyHint ?? 'search'}
            placeholder={p.placeholder} value={p.value} onChange={e => p.onChange(e.target.value)} onKeyDown={key}/>
          <button type="button" className="primary" onClick={p.onSubmit}>{p.submitLabel}</button>
        </div>
      </div>
    </div>, document.body);
}
