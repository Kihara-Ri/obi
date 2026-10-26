// PWA：注册 Service Worker、离线横幅状态、浏览器提供的安装入口（侧栏与「更多」页使用）。
import {useEffect, useState} from 'react';
import {isLocalSite} from '../core/backend';

export function usePwa() {
  const [offline, setOffline] = useState(!navigator.onLine && !isLocalSite());
  const [installEvt, setInstallEvt] = useState<Event | null>(null);
  useEffect(() => {
    navigator.serviceWorker?.register('/sw.js').catch(() => { /* 离线壳不可用不影响使用 */ });
    const on = () => setOffline(false);
    const off = () => setOffline(!isLocalSite()); // 本机站点（安卓版）数据在本地，断网不是故障，不显示常驻横幅
    const bip = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('beforeinstallprompt', bip);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('beforeinstallprompt', bip);
    };
  }, []);
  return {offline, installEvt, setInstallEvt};
}
