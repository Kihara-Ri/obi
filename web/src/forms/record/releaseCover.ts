// 选定发行版后的封面匹配：此版本自己的 Cover Art Archive 正面图优先，其次 iTunes 数字封面（标题+艺人精确）。
// 两路并行发出；封面只是展示图，不证明实物版次。
import {api} from '../../core/api';
import {displayReleaseTitle, exactDigitalCover} from '../../core/release-metadata';
import type {AlbumRecord, ReleaseCandidate} from '../../types';
import type {CoverCandidate} from './useCoverSearch';

export interface MatchedCover {
  cover?: string; coverSource?: AlbumRecord['coverSource']; status: string;
}

export async function matchReleaseCover(candidate: ReleaseCandidate, discogs: boolean,
                                        isCurrent: () => boolean): Promise<MatchedCover | null> {
  // 优先用确认的这个版本自己的正面图（CAA，Discogs 版本没有）；没有再用 iTunes 标题 + 艺人精确匹配的数字封面。
  // 两路同时发出，CAA 有图就立刻返回，不等 iTunes。
  const itunes = findItunes(candidate, isCurrent);
  if (!discogs) {
    const front = await api<{cover: string}>('catalog/front-cover?id=' + encodeURIComponent(candidate.id)).catch(() => null);
    if (!isCurrent()) return null;
    if (front?.cover) {
      return {cover: front.cover, coverSource: {title: candidate.title, artist: candidate.artist},
        status: '已匹配 · 此版本封面（Cover Art Archive）'};
    }
  }
  const found = await itunes;
  if (!isCurrent()) return null;
  return found ?? {status: '无精确封面，可点「换一张封面」'};
}

async function findItunes(candidate: ReleaseCandidate, isCurrent: () => boolean): Promise<MatchedCover | null> {
  try {
    const found = await api<{candidates: CoverCandidate[]}>('covers/search',
      {title: displayReleaseTitle(candidate.title), artist: candidate.artist, country: 'AUTO'});
    const exact = isCurrent() ? exactDigitalCover(found.candidates) : null;
    if (!exact) return null;
    const image = await api<{cover: string; coverSource: AlbumRecord['coverSource']}>(
      'covers/download', {token: exact.token});
    return image.cover ? {cover: image.cover, coverSource: image.coverSource, status: '已匹配 · iTunes'} : null;
  } catch {
    return null; // 网络或封面错误不影响已确认的发行版。
  }
}
