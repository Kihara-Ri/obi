// 页面级的「选中值」存放在组件内部会随路由切换丢失（进回收站再返回设置页，标签就跳回第一个）。
// useSessionState 把它记在当前浏览器标签页的 sessionStorage 里：离开 / 刷新页面后回来仍是原来的值，
// 关掉标签页或新开标签页回到默认值；读写失败（隐私模式等）时退化成普通 useState。
import {useCallback, useState} from 'react';

export function useSessionState<T extends string>(key: string, initial: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem('album-ui-' + key) as T | null;
      if (saved !== null && (!allowed || allowed.includes(saved))) return saved;
    } catch { /* 无法访问存储：用默认值 */ }
    return initial;
  });
  const set = useCallback((next: T) => {
    setValue(next);
    try { sessionStorage.setItem('album-ui-' + key, next); } catch { /* 忽略 */ }
  }, [key]);
  return [value, set];
}
