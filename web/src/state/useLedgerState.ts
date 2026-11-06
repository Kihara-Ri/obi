// Render cached ledger first; prepare missing public quotes separately, then refresh.
// Metadata saves never enter this preparation path.
import {useCallback, useEffect, useRef, useState} from 'react';
import type {AppState} from '../types';
import {fetchState, type StateSnapshot} from '../core/state-sync';
import {applyMetadataSave, type RecordMetadataSave} from '../core/record-metadata';
import {prepareQuotes} from '../core/rates';

export function useLedgerState() {
  const [state, setState] = useState<AppState | null>(null);
  const snapshot = useRef<StateSnapshot | null>(null);
  const preparing = useRef<AbortController | null>(null);
  const last = useRef({key: '', at: 0});
  const alive = useRef(true);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {alive.current = true; return () => {alive.current = false; preparing.current?.abort(); if (retryTimer.current) clearTimeout(retryTimer.current);};}, []);
  const refresh = useCallback(async function sync() {
    const before = snapshot.current;
    const next = await fetchState(before);
    if (snapshot.current !== before || !alive.current) return;
    if (next) {snapshot.current = next; setState(next.state);}
    const current = next ?? before;
    if (!current) return;
    const dates = current.state.rateService?.neededDates ?? [];
    const key = dates.join(',');
    if (!dates.length || preparing.current) return;
    const retry = (delay: number) => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => {retryTimer.current = null; void sync().catch(() => {});}, delay);
    };
    if (last.current.key === key && Date.now() - last.current.at < 300000) {
      retry(300100 - (Date.now() - last.current.at)); return;
    }
    const controller = new AbortController();
    preparing.current = controller;
    last.current = {key, at: Date.now()};
    // One request/window at a time; no-progress repeats pause until the retry period.
    void prepareQuotes(dates, controller.signal).then(async () => {
      if (preparing.current !== controller || !alive.current) return;
      preparing.current = null;
      await sync();
    }).catch(() => {
      if (preparing.current === controller) preparing.current = null;
      if (!controller.signal.aborted && alive.current) retry(300100);
    });
  }, []);
  useEffect(() => {
    const retry = state?.rateService?.retryAt;
    if (!retry || retry * 1000 <= Date.now()) return;
    const timer = setTimeout(() => {void refresh().catch(() => {});}, retry * 1000 - Date.now() + 100);
    return () => clearTimeout(timer);
  }, [state?.rateService?.retryAt, refresh]);
  const applyRecordMetadata = useCallback((saved: RecordMetadataSave) => {
    if (!snapshot.current) throw new Error('账本尚未加载');
    const next = applyMetadataSave(snapshot.current, saved);
    snapshot.current = next;
    setState(next.state);
  }, []);
  return {state, refresh, applyRecordMetadata};
}
