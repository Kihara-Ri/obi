// 选定发行版后的封面匹配：iTunes 数字封面（标题+艺人精确）优先，其次此版 Cover Art Archive。
// CAA 请求与 iTunes 并行发出，不必等 iTunes 落空再开始；封面只是展示图，不证明实物版次。
import {api} from '../../core/api';
import {displayReleaseTitle, exactDigitalCover} from '../../core/release-metadata';
import type {AlbumRecord, ReleaseCandidate} from '../../types';
import type {CoverCandidate} from './useCoverSearch';

export interface MatchedCover {
  cover?: string; coverSource?: AlbumRecord['coverSource']; status: string;
}

export async function matchReleaseCover(candidate: ReleaseCandidate, discogs: boolean,
                                        isCurrent: () => boolean): Promise<MatchedCover | null> {
  const caa = discogs ? null : api<{cover: string}>(
    'catalog/front-cover?id=' + encodeURIComponent(candidate.id)).catch(() => null);
  try {
    const found = await api<{candidates: CoverCandidate[]}>('covers/search',
      {title: displayReleaseTitle(candidate.title), artist: candidate.artist, country: 'AUTO'});
    if (!isCurrent()) return null;
    const exact = exactDigitalCover(found.candidates);
    if (exact) {
      const image = await api<{cover: string; coverSource: AlbumRecord['coverSource']}>(
        'covers/download', {token: exact.token});
      if (!isCurrent()) return null;
      if (image.cover) return {cover: image.cover, coverSource: image.coverSource, status: '已匹配 · iTunes'};
    }
  } catch {
    // 网络或封面错误不影响已确认的发行版。
  }
  if (!caa) return {status: '无精确封面，可手动查找'};
  const selected = await caa;
  if (!isCurrent()) return null;
  if (!selected) return {status: '封面暂不可用，可手动查找'};
  return selected.cover
    ? {cover: selected.cover, coverSource: {title: candidate.title, artist: candidate.artist},
       status: '已匹配 · Cover Art Archive'}
    : {status: '未找到封面，可手动查找'};
}
