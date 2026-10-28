// 发行版来源的单一事实来源：候选 id / 已确认 releaseInfo → 来源名、身份字段、资料库链接。
// 各页面不再写 `source === 'discogs' ? … : MusicBrainz` 的二选一；新增来源只改这里。
import type {ReleaseCandidate, ReleaseInfo} from '../types';

export type ReleaseSource = 'musicbrainz' | 'discogs' | 'deezer';

export const SOURCE_LABEL: Record<ReleaseSource, string> = {
  musicbrainz: 'MusicBrainz', discogs: 'Discogs', deezer: 'Deezer',
};

/** 候选 id 前缀 → 来源（MusicBrainz 用裸 UUID）。 */
export function sourceOf(candidate: ReleaseCandidate | string): ReleaseSource {
  const id = typeof candidate === 'string' ? candidate : candidate.id;
  if (id.startsWith('discogs-')) return 'discogs';
  if (id.startsWith('deezer-')) return 'deezer';
  return 'musicbrainz';
}

const NO_IDENTITY: Partial<ReleaseInfo> = {
  musicBrainzReleaseId: '', discogsReleaseId: '', deezerId: '', manualRelease: '',
};

/** 候选 → releaseInfo 的身份字段。除此之外的字段（名称 / 曲目 / 封面）不在这里决定。 */
export function identityFromCandidate(c: ReleaseCandidate): Partial<ReleaseInfo> {
  return identityFromId(c.id);
}

/** 只有 id 时同样能得到身份字段。 */
export function identityFromId(id: string): Partial<ReleaseInfo> {
  switch (sourceOf(id)) {
    case 'discogs': return {...NO_IDENTITY, discogsReleaseId: id.slice('discogs-'.length)};
    case 'deezer': return {...NO_IDENTITY, deezerId: id.slice('deezer-'.length)};
    default: return {...NO_IDENTITY, musicBrainzReleaseId: id};
  }
}

/** 已绑定的版本身份（与候选 id 同形），用于「当前是否已是这个版本」。 */
export function identityOf(info?: ReleaseInfo | null): string {
  if (!info) return '';
  return info.musicBrainzReleaseId
    || (info.discogsReleaseId ? 'discogs-' + info.discogsReleaseId : '')
    || (info.deezerId ? 'deezer-' + info.deezerId : '');
}

/** 已绑定的资料库来源；不含手动录入。 */
export function boundSource(info?: ReleaseInfo | null): ReleaseSource | null {
  if (!info) return null;
  if (info.musicBrainzReleaseId) return 'musicbrainz';
  if (info.discogsReleaseId) return 'discogs';
  if (info.deezerId) return 'deezer';
  return null;
}

/** 来源显示名。旧的 `sourceName(info, isDiscogs)` 调用点一律改成只传 info。 */
export function sourceName(info?: ReleaseInfo | null): string {
  const source = boundSource(info);
  return source ? SOURCE_LABEL[source] : 'MusicBrainz';
}

/** 已确认版本的资料库页面。 */
export function sourceUrl(info?: ReleaseInfo | null): string {
  if (!info) return '';
  if (info.musicBrainzReleaseId) return 'https://musicbrainz.org/release/' + info.musicBrainzReleaseId;
  if (info.discogsReleaseId) return 'https://www.discogs.com/release/' + info.discogsReleaseId;
  if (info.deezerId) return 'https://www.deezer.com/album/' + info.deezerId;
  return '';
}
