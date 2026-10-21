// 封面状态与「换一张封面」：封面随确认的发行版自动匹配（pickRelease → releaseCover），
// 这里只管状态（status / busy / hasCover）和用户主动换封面时的候选点选；不再在标题 / 艺人失焦时自动搜。
import {useState} from 'react';
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
  const [busy, setBusy] = useState(false);

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

  /** 换一张封面：按当前标题 / 艺人（已确认发行版则连同其规范名）列出候选（iTunes + MusicBrainz / CAA），由用户点选，不自动采用。 */
  async function findCover() {
    const key = coverKey();
    const title = v.title.trim(), artist = v.artist.trim();
    if (!title || !artist) {setCoverStatus('先填专辑名和艺人'); return;}
    setBusy(true);
    setCoverStatus('查找中…');
    setCandidates([]);
    try {
      const result = await api<{candidates: CoverCandidate[]; warnings?: string[]}>(
        'covers/search', {title, artist, country: 'AUTO', releaseId: v.releaseInfo.musicBrainzReleaseId || undefined});
      if (!stillCurrent(key)) return;
      let status = result.candidates.length ? `找到 ${result.candidates.length} 张封面，点选一张使用` : '未找到封面';
      if (result.warnings?.length) status += ' · 部分来源不可用';
      setCoverStatus(status);
      setCandidates(result.candidates);
    } catch (err) {
      if (stillCurrent(key)) setCoverStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return {coverStatus, setCoverStatus, candidates, setCandidates, hasCover, setHasCover,
    busy, setBusy, coverKey, chooseCover, findCover};
}
export type CoverSearch = ReturnType<typeof useCoverSearch>;
