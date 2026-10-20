// 复制按钮：点一下把 text 复制到剪贴板，图标短暂变成对勾并弹提示（失败也提示）。
// 只有图标（可读名称由 label 提供）；用在专辑详情的专辑名、唱片编号、条码旁，不要用在会被整行点击覆盖的区域。
import {useEffect, useRef, useState} from 'react';
import {copyText} from '../../core/clipboard';
import {useApp} from '../../state/AppContext';
import {CheckIco, CopyIco} from '../icons';
import './CopyButton.css';

export function CopyButton({text, label}: {text: string; label: string}) {
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
  return <button type="button" className={`copy-btn${done ? ' is-done' : ''}`} aria-label={label} title={label}
    onClick={() => void copy()}>{done ? CheckIco : CopyIco}</button>;
}
