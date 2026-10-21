// useLeaving：open 由 true 变 false 后的 ms 毫秒内返回 true，供浮层播放退出动画后再隐藏。
// 初始 / 重新打开时恒为 false，所以服务端渲染与首屏结构不变。
// leaving 必须在 open 变 false 的同一次渲染里就为 true（渲染期派生 state），
// 若放进 useEffect，会先绘一帧「已隐藏」再重新显示做退出动画，看起来就是收起后闪一下。
import {useEffect, useState} from 'react';

export function useLeaving(open: boolean, ms: number): boolean {
  const [leaving, setLeaving] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setLeaving(!open);
  }
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setLeaving(false), ms);
    return () => window.clearTimeout(t);
  }, [leaving, ms]);
  return leaving;
}
