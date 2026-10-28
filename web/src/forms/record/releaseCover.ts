// 选定发行版后的封面匹配，顺序与版本卡片一致（core/version-cover.ts）：
// 此版本自己的 Cover Art Archive 正面图 → 同一张专辑的封面 → 同名同艺人的 iTunes 数字封面。
// 退路的查询与正面图并行发出；封面只是展示图，不证明实物版次。
import {api} from '../../core/api';
import {isLocalSite} from '../../core/backend';
import {borrowedCover, ownCoverBase} from '../../core/version-cover';
import type {AlbumRecord, ReleaseCandidate} from '../../types';

/** 服务器模式：让服务端把封面落盘，只回短引用（保存时不再从手机上传整张图）；本机模式图本就在设备内，不带。 */
export const stashCovers = () => !isLocalSite();

export interface MatchedCover {
  cover?: string; coverSource?: AlbumRecord['coverSource']; status: string;
}

export async function matchReleaseCover(candidate: ReleaseCandidate, isCurrent: () => boolean): Promise<MatchedCover | null> {
  const borrowed = borrowedCover(candidate);
  if (ownCoverBase(candidate)) {
    const front = await api<{cover: string}>('catalog/front-cover?' + (stashCovers() ? 'stash=1&' : '') + 'id=' + encodeURIComponent(candidate.id)).catch(() => null);
    if (!isCurrent()) return null;
    if (front?.cover) {
      return {cover: front.cover, coverSource: {title: candidate.title, artist: candidate.artist, provider: 'Cover Art Archive（此版本）'},
        status: '此版本自己的封面'};
    }
  } else if (candidate.cover) {
    // Deezer 候选自带封面：交给服务端下载并落盘，和 CAA 封面走同一套备份。
    try {
      const image = await api<{cover: string; coverSource: AlbumRecord['coverSource']}>('covers/download',
        {token: candidate.cover, ...(stashCovers() ? {stash: true} : {})});
      if (!isCurrent()) return null;
      if (image.cover) return {cover: image.cover, coverSource: image.coverSource, status: '此版本自己的封面'};
    } catch { /* 下载失败退回借用封面 */ }
  }
  const found = await borrowed;
  if (!isCurrent()) return null;
  if (found) {
    try {
      const image = await api<{cover: string; coverSource: AlbumRecord['coverSource']}>(
        'covers/download', {token: found.token, ...(stashCovers() ? {stash: true} : {})});
      if (!isCurrent()) return null;
      if (image.cover) return {cover: image.cover, coverSource: image.coverSource,
        status: found.kind === 'album' ? '借用同专辑的封面，包装可能不同' : '借用 iTunes 数字封面，包装可能不同'};
    } catch { /* 网络或封面错误不影响已确认的发行版 */ }
  }
  return {status: '没找到封面，可以换一张或上传'};
}
