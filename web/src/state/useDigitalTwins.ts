import {useCallback, useEffect, useRef, useState} from 'react';
import {api, ApiError} from '../core/api';
import {mergeTwinIndex, twinBusy} from '../core/digital-twins';
import type {TwinIndex} from '../types';

/** Owned by AppContext's provider, shared by gallery and management entry points. */
export function useDigitalTwins(enabled: boolean) {
  const [twins, setTwins] = useState<TwinIndex>({epoch: '', revision: 0, jobs: {}, configured: false, skill: ''});
  const [twinSyncError, setSyncError] = useState('');
  const latest = useRef(twins); latest.current = twins;
  const poll = useRef(0);
  const refreshTwins = useCallback(async () => {
    const issued = ++poll.current;
    try {
      const next = await api<TwinIndex>('twins');
      if (issued === poll.current) {setTwins(current => mergeTwinIndex(current, next)); setSyncError('');}
    } catch (error) {
      if (issued === poll.current) setSyncError(error instanceof ApiError && error.status === 404
        ? '数字实体服务尚未更新，请重启服务' : '暂时无法同步任务状态，恢复连接后会继续确认');
      throw error;
    }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let alive = true; let timer = 0;
    const sync = async () => {
      if (!document.hidden) await refreshTwins().catch(() => {});
      if (alive) timer = window.setTimeout(sync, Object.values(latest.current.jobs).some(twinBusy) ? 1800 : 8000);
    };
    const foreground = () => {if (!document.hidden) void refreshTwins().catch(() => {});};
    const change = (event: StorageEvent) => {if (event.key === 'digital-twin-notify') foreground();};
    void sync(); window.addEventListener('focus', foreground); window.addEventListener('online', foreground);
    window.addEventListener('storage', change); document.addEventListener('visibilitychange', foreground);
    return () => {
      alive = false; clearTimeout(timer); poll.current++;
      window.removeEventListener('focus', foreground); window.removeEventListener('online', foreground);
      window.removeEventListener('storage', change); document.removeEventListener('visibilitychange', foreground);
    };
  }, [enabled, refreshTwins]);
  return {twins, twinSyncError, refreshTwins};
}
