// 介质（D-053）：不单独存字段，从发行资料的 format / media[].format 推出来；没写介质的旧记录按 CD。
// 与服务端 domain.medium_of 同一套识别（7″ / 10″ / 12″、LP、Vinyl 都算黑胶）。查询时随请求带上 medium，服务端缺省按 CD。
import type {ReleaseInfo} from '../types';

export type Medium = 'cd' | 'vinyl' | 'other';
export type LookupMedium = 'auto' | Medium;
export const MEDIA: Medium[] = ['cd', 'vinyl', 'other'];
export const MEDIUM_LABEL: Record<Medium, string> = {cd: 'CD', vinyl: '黑胶', other: '其他'};
export const MEDIUM_OPTIONS = MEDIA.map(value => ({value, label: MEDIUM_LABEL[value]}));
export const LOOKUP_MEDIUM_OPTIONS = [{value: 'auto', label: '自动'}, ...MEDIUM_OPTIONS];
/** 手动录入时写进 releaseInfo.format 的介质名（之后就能从资料里认回来） */
export const MEDIUM_FORMAT: Record<Medium, string> = {cd: 'CD', vinyl: 'Vinyl', other: 'Other'};

const VINYL = /vinyl|\blp\b|(?<![\d.])(7|10|12)\s*(″|"|”|inch|in\b|吋|寸)|黑胶|レコード|アナログ/i;
const NO_PHYSICAL_FORMAT = /\b(?:digital|file|mp3|flac|wav|download|unknown|unspecified|none)\b/i;

/** 一段格式文字的介质；空文字返回 null */
export function mediumOf(text?: string | null): Medium | null {
  const t = (text || '').trim();
  if (!t) return null;
  if (VINYL.test(t)) return 'vinyl';
  return /cd/i.test(t) ? 'cd' : 'other';
}

/** 一张唱片 / 一个发行版的介质：先看整体 format，再看各碟；都没写按 CD */
export function recordMedium(info?: Partial<ReleaseInfo> | null): Medium {
  return mediumOf(info?.format) ?? info?.media?.map(m => mediumOf(m.format)).find(Boolean) ?? 'cd';
}

/** 查版次时只采用明确的格式。数字发行和空格式需要用户确认实物介质。 */
export function reportedMedium(info?: ReleaseInfo | null): Medium | null {
  const format = info?.format?.trim() || info?.media?.find(disc => disc.format.trim())?.format || '';
  const medium = mediumOf(format);
  return medium === 'other' && NO_PHYSICAL_FORMAT.test(format) ? null : medium;
}

/** 同一版本的详情如果缺格式，保留摘要已经给出的格式。 */
export function mergeCatalogDetails(summary: ReleaseInfo, details: ReleaseInfo): ReleaseInfo {
  const info = {...summary, ...details};
  if (!details.format && !details.media?.some(disc => disc.format)) info.format = summary.format;
  return info;
}

/** 候选没有实物格式时，可复用本次明确选择的介质。 */
export function withLookupMedium(info: ReleaseInfo, medium: LookupMedium): ReleaseInfo {
  return medium === 'auto' || reportedMedium(info) ? info : {...info, format: MEDIUM_FORMAT[medium]};
}

export const isMedium = (v: string): v is Medium => (MEDIA as string[]).includes(v);
export const isLookupMedium = (v: string): v is LookupMedium => v === 'auto' || isMedium(v);
