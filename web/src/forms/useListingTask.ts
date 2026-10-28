// 管理一次自动准备任务及轮询；关闭抽屉停止请求，服务端任务仍按启动时的意图完成。
import {useEffect, useRef, useState} from 'react';
import {api} from '../core/api';
import type {ListingJob} from '../core/listing';

export function useListingTask(onResult: (job: ListingJob) => Promise<void>) {
  const [job, setJob] = useState<ListingJob>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => {request.current?.abort(); window.clearTimeout(timer.current);}, []);
  const start = async (data: object) => {
    request.current?.abort(); window.clearTimeout(timer.current);
    const abort = new AbortController(); request.current = abort;
    setBusy(true); setError(''); setJob(undefined);
    const fail = (e: unknown) => {
      if (!abort.signal.aborted) {setError(e instanceof Error ? e.message : '生成失败，请重试'); setBusy(false);}
    };
    try {
      const started = await api<ListingJob>('listing/generate', data, {signal: abort.signal});
      setJob(started);
      const poll = async () => {
        try {
          const result = await api<ListingJob>(`listing/job?id=${started.id}`, undefined, {signal: abort.signal});
          setJob(result);
          if (result.status === 'running') {timer.current = window.setTimeout(() => {void poll();}, 1000); return;}
          if (result.status === 'failed') throw new Error(result.error || '生成失败，请重试');
          await onResult(result);
          if (!abort.signal.aborted) setBusy(false);
        } catch (e) {fail(e);}
      };
      await poll();
    } catch (e) {fail(e);}
  };
  return {job, busy, error, start};
}
