// 管理一次自动准备任务及轮询；支持抽屉离开后重新打开无缝接管后台运行中的任务。
import {useEffect, useRef, useState} from 'react';
import {api} from '../core/api';
import type {ListingJob} from '../core/listing';

export function useListingTask(onResult: (job: ListingJob) => Promise<void>) {
  const [job, setJob] = useState<ListingJob>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const dismissed = useRef<Set<string>>(new Set());

  useEffect(() => () => {
    request.current?.abort();
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const poll = async (jobId: string, abort: AbortController) => {
    try {
      const result = await api<ListingJob>(`listing/job?id=${jobId}`, undefined, {signal: abort.signal});
      setJob(result);
      if (result.status === 'running') {
        const interval = result.phase === 'writing' ? 150 : 800;
        timer.current = window.setTimeout(() => { void poll(jobId, abort); }, interval);
        return;
      }
      if (result.status === 'failed') throw new Error(result.error || '生成失败，请重试');
      await onResult(result);
      if (!abort.signal.aborted) setBusy(false);
    } catch (e) {
      if (!abort.signal.aborted) {
        setError(e instanceof Error ? e.message : '生成失败，请重试');
        setBusy(false);
      }
    }
  };

  const start = async (data: object) => {
    request.current?.abort();
    if (timer.current) window.clearTimeout(timer.current);
    const abort = new AbortController();
    request.current = abort;
    setBusy(true);
    setError('');
    setJob(undefined);
    try {
      const started = await api<ListingJob>('listing/generate', data, {signal: abort.signal});
      setJob(started);
      if (started.id) await poll(started.id, abort);
    } catch (e) {
      if (!abort.signal.aborted) {
        setError(e instanceof Error ? e.message : '生成失败，请重试');
        setBusy(false);
      }
    }
  };

  const attach = async (recordId: string) => {
    if (busy) return;
    try {
      const current = await api<ListingJob>(`listing/job?recordId=${recordId}`);
      if (!current || current.status === 'idle') return;
      if (current.status === 'running' && current.id) {
        request.current?.abort();
        if (timer.current) window.clearTimeout(timer.current);
        const abort = new AbortController();
        request.current = abort;
        setBusy(true);
        setError('');
        setJob(current);
        await poll(current.id, abort);
      } else if (current.status === 'succeeded' && current.draft && (!current.id || !dismissed.current.has(current.id))) {
        setJob(current);
        await onResult(current);
      }
    } catch {
      // 静默处理，不影响正常打开查看
    }
  };

  const dismiss = (jobId?: string) => {
    if (jobId) dismissed.current.add(jobId);
  };

  return {job, busy, error, start, attach, dismiss};
}
