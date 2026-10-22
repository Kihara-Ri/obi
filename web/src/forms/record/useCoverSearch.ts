// 封面状态与「换一张封面」：封面随确认的发行版自动匹配（pickRelease → releaseCover），
// 这里只管状态（status / busy / hasCover）和用户主动换封面时的候选点选；不再在标题 / 艺人失焦时自动搜。
import {useState} from 'react';
import {api} from '../../core/api';
import type {FormCtx} from './context';

export interface CoverCandidate {
  token: string; title: string; artist: string; year?: string;
  thumbnail: string; exact: boolean; provider?: string;
}
export const dropCandidate = (list: CoverCandidate[], token: string) => list.filter(c => c.token !== token);

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
    // 已确认发行版：它自己的正面图不用等搜索，浏览器直取缩略图，先摆出来供点选（没有图时缩略图加载失败会自动撤下）
    const rid = v.releaseInfo.musicBrainzReleaseId;
    const own: CoverCandidate[] = rid && /^[0-9a-f-]{36}$/.test(rid) ? [{
      token: 'CAAR-' + rid, title: '此版本的封面', artist: '', exact: true, provider: 'Cover Art Archive',
      thumbnail: `https://coverartarchive.org/release/${rid}/front-250`}] : [];
    setCandidates(own);
    if (own.length) setCoverStatus('此版本的封面已列出，继续查找更多…');
    try {
      const result = await api<{candidates: CoverCandidate[]; warnings?: string[]}>(
        'covers/search', {title, artist, country: 'AUTO', releaseId: v.releaseInfo.musicBrainzReleaseId || undefined});
      if (!stillCurrent(key)) return;
      let status = result.candidates.length ? `找到 ${result.candidates.length} 张封面` : '未找到封面';
      if (result.warnings?.length) status += ' · 部分来源不可用';
      setCoverStatus(status);
      // 搜索结果里同一张图不重复；本版封面仍排最前
      setCandidates(prev => [...prev.filter(c => c.token.startsWith('CAAR-')), ...result.candidates.filter(c => c.thumbnail !== own[0]?.thumbnail)]);
    } catch (err) {
      if (stillCurrent(key)) setCoverStatus(own.length ? '此版本的封面已列出；其他来源暂时查不到' : err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return {coverStatus, setCoverStatus, candidates, setCandidates, hasCover, setHasCover,
    busy, setBusy, coverKey, chooseCover, findCover};
}
export type CoverSearch = ReturnType<typeof useCoverSearch>;
