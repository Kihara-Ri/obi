// 库存页「列表 / 卡片」视图：记在 localStorage，未手动切换过时按窗口宽度给默认。
import {useCallback, useState} from 'react';

const KEY = 'obi-shelf-view';
// 改名前写下的键（diedu-*）；读到即迁移到新键
const LEGACY_KEYS = ['diedu-shelf-view', 'obi-mobile-shelf-view', 'diedu-mobile-shelf-view'];

export type ShelfView = 'list' | 'cards';

export function useShelfView() {
  const [shelfView, setShelfViewState] = useState<ShelfView>(() => {
    // 未手动切换过时按窗口宽度给默认：手机紧凑列表，桌面维持原卡片布局。
    const fallback = () => { try { return matchMedia('(max-width:840px)').matches ? 'list' : 'cards'; } catch { return 'list'; } };
    try {
      let v = localStorage.getItem(KEY);
      if (v === null) {
        v = LEGACY_KEYS.map(k => localStorage.getItem(k)).find(x => x !== null) ?? null;
        if (v !== null) localStorage.setItem(KEY, v);
        for (const k of LEGACY_KEYS) localStorage.removeItem(k);
      }
      return v === 'list' || v === 'cards' ? v : fallback();
    } catch { return fallback(); }
  });
  const setShelfView = useCallback((v: ShelfView) => {
    setShelfViewState(v);
    try {
      localStorage.setItem(KEY, v);
    } catch { /* 浏览器不允许存储时仍可切换视图 */ }
  }, []);
  return [shelfView, setShelfView] as const;
}
