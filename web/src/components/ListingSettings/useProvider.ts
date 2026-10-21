// 单个服务商的状态与操作：只读取/修改自己（?provider=），不切换"分析在用"，除非显式 use()。
import {useCallback, useEffect, useRef, useState} from 'react';
import {api} from '../../core/api';
import type {ListingProvider, ListingProviderId} from '../../core/listing';

const bus = new EventTarget();
export const onListingChanged = (fn: () => void) => {bus.addEventListener('change', fn); return () => bus.removeEventListener('change', fn);};

export function useProvider(id: ListingProviderId) {
  const [provider, setProvider] = useState<ListingProvider>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const popup = useRef<Window | null>(null);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    const value = await api<ListingProvider>(`listing/status?provider=${id}`);
    if (request === sequence.current) setProvider(value);
  }, [id]);
  useEffect(() => {
    void refresh().catch(e => setError(e.message));
    return () => {sequence.current++;};
  }, [refresh]);
  useEffect(() => {
    if (!provider?.loginPending) return;
    const timer = window.setInterval(() => {void refresh().catch(e => setError(e.message));}, 2000);
    return () => window.clearInterval(timer);
  }, [provider?.loginPending, refresh]);
  useEffect(() => {
    if (provider?.loginUrl && popup.current && !popup.current.closed) {
      popup.current.location.href = provider.loginUrl;
      popup.current = null;
    }
  }, [provider?.loginUrl]);
  const run = async (work: () => Promise<unknown>) => {
    ++sequence.current; setBusy(true); setError('');
    try {await work(); await refresh(); bus.dispatchEvent(new Event('change'));}
    catch (e) {setError(e instanceof Error ? e.message : '操作失败');}
    finally {setBusy(false);}
  };
  const configure = (patch: object) => run(() => api('listing/provider', {provider: id, ...patch}));
  const login = (account = '') => {
    const windowRef = window.open('about:blank', '_blank');
    if (windowRef) windowRef.opener = null;
    popup.current = windowRef;
    void run(async () => {
      try {
        if (!windowRef) throw new Error('请允许弹出窗口后重试');
        const {url} = await api<{url: string}>('listing/login', {provider: id, account});
        if (url) {windowRef.location.href = url; popup.current = null;}
      } catch (e) {windowRef?.close(); popup.current = null; throw e;}
    });
  };
  return {provider, error: error || provider?.loginError || '', busy, run, configure, login};
}
