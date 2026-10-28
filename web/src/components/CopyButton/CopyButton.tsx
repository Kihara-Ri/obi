// 复制按钮：点一下把 text 复制到剪贴板，图标短暂变成对勾并弹提示（失败也提示）。
// 默认图标用于元数据旁；variant=button 提供带文字的主操作。不要用于会被整行点击覆盖的区域。
import {useEffect, useRef, useState} from 'react';
import {copyText} from '../../core/clipboard';
import {useApp} from '../../state/AppContext';
import {CheckIco, CopyIco} from '../icons';
import './CopyButton.css';

export function CopyButton({text, label, variant = 'icon', disabled = false}: {text: string; label: string; variant?: 'icon' | 'button'; disabled?: boolean}) {
  const app = useApp();
  const [done, setDone] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    const ok = await copyText(text);
    if (!ok) { app.toast('复制失败，请长按文字手动复制', 'warn'); return; }
    app.toast(`已复制：${text.length > 28 ? text.slice(0, 28) + '…' : text}`);
    setDone(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), 1600);
  };
  return <button type="button" className={`${variant === 'button' ? 'copy-button primary' : 'copy-btn'}${done ? ' is-done' : ''}`} disabled={disabled} aria-label={label} title={label}
    onClick={() => void copy()}>{done ? CheckIco : CopyIco}{variant === 'button' ? <span>{done ? '已复制' : label}</span> : null}</button>;
}
