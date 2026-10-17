import {useCallback, useEffect, useRef, useState} from 'react';
import {api} from '../core/api';
import {loadAlbumEngine} from '../core/album-engine-plugin';
import type {AlbumEngineRuntime, AlbumEngineStatus} from '../core/album-engine-plugin';

/** The provider owns the sole plugin runtime; engine roots never own host state. */
export function useAlbumEngine() {
  const [status, setStatus] = useState<AlbumEngineStatus | null>(null);
  const [loaded, setLoaded] = useState<{entry: string; revision: number; runtime: AlbumEngineRuntime} | null>(null);
  const [syncError, setSyncError] = useState('');
  const [runtimeError, setRuntimeError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [changing, setChanging] = useState(false);
  const mutation = useRef(false), sequence = useRef(0);
  const latest = useRef(status); latest.current = status;
  const refresh = useCallback(async () => {
    const issued = ++sequence.current;
    try {
      const next = await api<AlbumEngineStatus>('plugins/album-engine');
      if (issued === sequence.current) {setStatus(next); setSyncError('');}
    } catch (exc) {
      if (issued === sequence.current) setSyncError(exc instanceof Error ? exc.message : '暂时无法同步引擎状态');
    }
  }, []);
  const change = useCallback(async (action: 'install' | 'uninstall') => {
    if (mutation.current || !latest.current) return;
    mutation.current = true; setChanging(true); sequence.current++;
    try {
      const next = await api<AlbumEngineStatus>('plugins/album-engine/' + action, {expectedRevision: latest.current.revision});
      sequence.current++; setStatus(next); setSyncError('');
      if (!next.installed) setLoaded(null);
      try {localStorage.setItem('album-engine-notify', String(Date.now()) + Math.random());} catch { /* Polling remains available. */ }
    } catch (exc) {await refresh(); throw exc;}
    finally {mutation.current = false; setChanging(false);}
  }, [refresh]);
  const install = useCallback(() => change('install'), [change]);
  const uninstall = useCallback(() => change('uninstall'), [change]);
  useEffect(() => {
    let alive = true; let timer = 0;
    const sync = async () => {if (!document.hidden && !mutation.current) await refresh(); if (alive) timer = window.setTimeout(sync, 8000);};
    const foreground = () => {if (!document.hidden && !mutation.current) void refresh();};
    const changed = (event: StorageEvent) => {if (event.key === 'album-engine-notify') foreground();};
    void sync(); window.addEventListener('focus', foreground); window.addEventListener('online', foreground);
    window.addEventListener('storage', changed); document.addEventListener('visibilitychange', foreground);
    return () => {alive = false; clearTimeout(timer); sequence.current++; window.removeEventListener('focus', foreground);
      window.removeEventListener('online', foreground); window.removeEventListener('storage', changed); document.removeEventListener('visibilitychange', foreground);};
  }, [refresh]);
  useEffect(() => {
    setLoaded(null); setRuntimeError('');
    if (!status?.installed || !status.entryUrl) {setLoading(false); return;}
    let alive = true;
    const link = document.createElement('link'); link.rel = 'stylesheet';
    if (status.styleUrl) {link.href = status.styleUrl; document.head.append(link);}
    setLoading(true);
    void loadAlbumEngine(status).then(runtime => {if (alive) setLoaded({entry: status.entryUrl!, revision: status.revision, runtime});})
      .catch(exc => {if (alive) setRuntimeError(exc instanceof Error ? exc.message : '引擎加载失败');})
      .finally(() => {if (alive) setLoading(false);});
    return () => {alive = false; link.remove();};
  }, [status?.installed, status?.entryUrl, status?.styleUrl, status?.revision, loadAttempt]);
  const runtime = status?.installed && loaded?.entry === status.entryUrl && loaded.revision === status.revision ? loaded.runtime : null;
  const retry = useCallback(async () => {setLoadAttempt(value => value + 1); await refresh();}, [refresh]);
  return {status, runtime, error: runtimeError || syncError, loading, changing, refresh, retry, install, uninstall};
}
export type AlbumEngineState = ReturnType<typeof useAlbumEngine>;
