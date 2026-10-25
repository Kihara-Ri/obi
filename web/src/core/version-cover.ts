// 一个发行版本的封面退路（版本卡片与「选用此版本」后的自动匹配共用，查询页与专辑表单同一顺序）：
// ① 这个版本自己的正面图（Cover Art Archive，调用方直接取）→ ② 同一张专辑的封面 → ③ 同名同艺人的 iTunes 数字封面。
// ②③ 由服务端 covers/fallback 判定，只认名字精确对上的；借来的封面要提示「不一定是这个版本的包装」。
import {api} from './api';
import {displayReleaseTitle} from './release-metadata';
import type {ReleaseCandidate} from '../types';

export interface BorrowedCover {
  token: string; thumbnail: string; title: string; artist: string; provider?: string;
  /** album：同一张专辑的其他版本；digital：iTunes 数字版 */
  kind: 'album' | 'digital';
}

/** 这个版本自己的封面目录（MusicBrainz 版本才有；Discogs 版本没有） */
export const ownCoverBase = (c: ReleaseCandidate) =>
  c.source !== 'discogs' && /^[0-9a-f-]{36}$/.test(c.id) ? 'https://coverartarchive.org/release/' + c.id + '/' : '';

export const BORROWED_NOTE: Record<BorrowedCover['kind'], string> = {
  album: '这个版本自己没有封面，先用同一张专辑的封面，不一定是这个版本的包装。',
  digital: '这个版本自己没有封面，先用同名专辑的数字版封面（iTunes），不一定是这个版本的包装。',
};

const asked = new Map<string, Promise<BorrowedCover | null>>();

/** ②③：同一版本只问一次服务端（卡片折叠 / 展开、选用后匹配都复用这次结果）；网络失败按没有处理且允许下次重试。 */
export function borrowedCover(c: ReleaseCandidate): Promise<BorrowedCover | null> {
  const hit = asked.get(c.id);
  if (hit) return hit;
  const ask = api<{candidate: BorrowedCover | null}>('covers/fallback', {
    title: displayReleaseTitle(c.title), artist: c.artist, releaseId: ownCoverBase(c) ? c.id : undefined,
  }).then(r => r.candidate ?? null, () => { asked.delete(c.id); return null; });
  asked.set(c.id, ask);
  return ask;
}
