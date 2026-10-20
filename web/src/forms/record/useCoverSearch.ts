// 封面自动抓取与候选选择：唯一精确匹配自动带入，其余由用户点选。
import {useEffect, useRef, useState} from 'react';
import {api} from '../../core/api';
import type {FormCtx} from './context';

export interface CoverCandidate {
  token: string; title: string; artist: string; year?: string;
  thumbnail: string; exact: boolean; provider?: string;
}

export function useCoverSearch(ctx: FormCtx, hadCover: boolean) {
  const {v, base, dirty, formRef} = ctx;
  const [coverStatus, setCoverStatus] = useState(hadCover ? '使用现有封面' : '尚无封面');
  const [candidates, setCandidates] = useState<CoverCandidate[]>([]);
  const [hasCover, setHasCover] = useState(hadCover);
  const lastQuery = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const coverKey = () => `${v.title.trim()}\n${v.artist.trim()}`;
  const stillCurrent = (key: string) => formRef.current?.isConnected && coverKey() === key;

  async function chooseCover(token: string, key: string) {
    setCoverStatus('下载中…');
    try {
      const result = await api<{cover: string; coverSource: {title: string; artist: string}}>(
        'covers/download', {token});
      if (!stillCurrent(key)) return;
      base.current = {...base.current, cover: result.cover, coverSource: result.coverSource};
      setHasCover(true);
      setCoverStatus(`已匹配 · ${result.coverSource.title}`);
      setCandidates([]);
      dirty();
    } catch (err) {
      if (stillCurrent(key)) setCoverStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function findCover(automatic: boolean) {
    const key = coverKey();
    const title = v.title.trim(), artist = v.artist.trim();
    if (!title || !artist) {
      if (!automatic) setCoverStatus('先填专辑名和艺人');
      return;
    }
    if (automatic && (hasCover || lastQuery.current === key)) return;
    lastQuery.current = key;
    setCoverStatus('查找中…');
    setCandidates([]);
    try {
      const result = await api<{candidates: CoverCandidate[]; warnings?: string[]}>(
        'covers/search', {title, artist, country: 'AUTO'});
      if (!stillCurrent(key)) return;
      const cs = result.candidates;
      const exact = cs.filter(c => c.exact);
      if (automatic && !hasCover && exact.length === 1) {
        await chooseCover(exact[0].token, key);
        return;
      }
      let status = cs.length ? '点击选择封面' : '未找到封面';
      if (result.warnings?.length) status += ' · 部分来源不可用';
      setCoverStatus(status);
      setCandidates(cs);
    } catch (err) {
      if (stillCurrent(key)) setCoverStatus(err instanceof Error ? err.message : String(err));
    }
  }

  const scheduleCover = () => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => findCover(true), 450);
  };
  useEffect(() => () => { clearTimeout(timer.current); }, []);

  return {coverStatus, setCoverStatus, candidates, setCandidates, hasCover, setHasCover,
    lastQuery, coverKey, chooseCover, findCover, scheduleCover};
}
export type CoverSearch = ReturnType<typeof useCoverSearch>;
