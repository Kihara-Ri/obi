// 手机库存列表的左滑演示：每个浏览器只演示一次（第一行可左滑的专辑自动滑开一下再收回）。
import {useCallback, useRef, useState} from 'react';

const KEY = 'obi-swipe-hint';

export function useSwipeHint() {
  const [pending] = useState(() => { try { return localStorage.getItem(KEY) !== '1'; } catch { return false; } });
  const played = useRef(false);
  const shown = useCallback(() => {
    played.current = true;
    try { localStorage.setItem(KEY, '1'); } catch { /* 无痕模式等：下次再演示 */ }
  }, []);
  /** 这一行是否该演示：还没演示过，且它是当前列表里第一行可左滑的 */
  const isHint = (id: string, firstId: string | undefined) => pending && !played.current && id === firstId;
  return {isHint, shown};
}
