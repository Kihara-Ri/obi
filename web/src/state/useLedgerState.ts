// 账本同步的唯一状态源：普通刷新取财务派生结果，元数据保存直接合并确认结果。
// 请求在保存前启动、保存后才返回时丢弃，防止旧响应把刚保存的资料覆盖回去。
import {useCallback, useRef, useState} from 'react';
import type {AppState} from '../types';
import {fetchState, type StateSnapshot} from '../core/state-sync';
import {applyMetadataSave, type RecordMetadataSave} from '../core/record-metadata';

export function useLedgerState() {
  const [state, setState] = useState<AppState | null>(null);
  const snapshot = useRef<StateSnapshot | null>(null);
  const refresh = useCallback(async () => {
    const before = snapshot.current;
    const next = await fetchState(before);
    if (!next || snapshot.current !== before) return;
    snapshot.current = next;
    setState(next.state);
  }, []);
  const applyRecordMetadata = useCallback((saved: RecordMetadataSave) => {
    if (!snapshot.current) throw new Error('账本尚未加载');
    const next = applyMetadataSave(snapshot.current, saved);
    snapshot.current = next;
    setState(next.state);
  }, []);
  return {state, refresh, applyRecordMetadata};
}
