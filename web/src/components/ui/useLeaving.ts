// useLeaving：open 由 true 变 false 后的 ms 毫秒内返回 true，供浮层播放退出动画后再隐藏。
// 初始 / 重新打开时恒为 false，所以服务端渲染与首屏结构不变。
import {useEffect, useRef, useState} from 'react';

export function useLeaving(open: boolean, ms: number): boolean {
  const [leaving, setLeaving] = useState(false);
  const was = useRef(open);
  useEffect(() => {
    if (open) { was.current = true; setLeaving(false); return; }
    if (!was.current) return;
    was.current = false;
    setLeaving(true);
    const t = window.setTimeout(() => setLeaving(false), ms);
    return () => window.clearTimeout(t);
  }, [open, ms]);
  return leaving;
}
