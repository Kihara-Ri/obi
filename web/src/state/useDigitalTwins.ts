import {useCallback, useEffect, useRef, useState} from 'react';
import {api, ApiError} from '../core/api';
import {mergeTwinIndex, twinBusy} from '../core/digital-twins';
import type {TwinIndex, TwinJob, TwinStart} from '../types';

type JobResponse = {epoch: string; revision: number; job: TwinJob};

/** Owned by AppContext's provider, shared by gallery and management entry points. */
export function useDigitalTwins(enabled: boolean) {
  const [twins, setTwins] = useState<TwinIndex>({epoch: '', revision: 0, jobs: {}, configured: false, skill: ''});
  const [twinSyncError, setSyncError] = useState('');
  const latest = useRef(twins); latest.current = twins;
  const requests = useRef(new Map<string, {key: string; expected: string | null; pending: boolean}>());
  const poll = useRef(0);
  const commit = useCallback((result: JobResponse) => {
    setTwins(current => {
      if (current.epoch && result.epoch !== current.epoch) return current;
      if (result.revision < current.revision) return current;
      return {...current, epoch: result.epoch, revision: result.revision, jobs: {...current.jobs, [result.job.recordId]: result.job}};
    });
  }, []);
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
  const notify = () => {try {localStorage.setItem('digital-twin-notify', String(Date.now()) + Math.random());} catch { /* Polling still works without browser storage. */ }};
  const startTwin = useCallback(async (input: TwinStart) => {
    let attempt = requests.current.get(input.recordId);
    if (attempt?.pending) return;
    if (!attempt || attempt.expected !== input.expectedJobId) {
      attempt = {key: Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join(''), expected: input.expectedJobId, pending: false};
      requests.current.set(input.recordId, attempt);
    }
    attempt.pending = true;
    try {
      const result = await api<JobResponse>('twins/start', {...input, requestId: attempt.key});
      commit(result); requests.current.delete(input.recordId); notify(); await refreshTwins().catch(() => {});
    } catch (error) {
      // Keep the same key after a lost response; another click confirms that
      // accepted request instead of issuing another paid generation.
      void refreshTwins().catch(() => {}); throw error;
    } finally {attempt.pending = false;}
  }, [commit, refreshTwins]);
  const cancelTwin = useCallback(async (id: string) => {
    commit(await api<JobResponse>('twins/cancel', {id})); notify(); await refreshTwins();
  }, [commit, refreshTwins]);
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
  return {twins, twinSyncError, refreshTwins, startTwin, cancelTwin};
}
