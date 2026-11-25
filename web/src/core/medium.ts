// 介质（D-053）：不单独存字段，从发行资料的 format / media[].format 推出来；没写介质的旧记录按 CD。
// 与服务端 domain.medium_of 同一套识别（7″ / 10″ / 12″、LP、Vinyl 都算黑胶）。查询时随请求带上 medium，服务端缺省按 CD。
import type {ReleaseInfo} from '../types';

export type Medium = 'cd' | 'vinyl' | 'other';
export const MEDIA: Medium[] = ['cd', 'vinyl', 'other'];
export const MEDIUM_LABEL: Record<Medium, string> = {cd: 'CD', vinyl: '黑胶', other: '其他'};
/** 手动录入时写进 releaseInfo.format 的介质名（之后就能从资料里认回来） */
export const MEDIUM_FORMAT: Record<Medium, string> = {cd: 'CD', vinyl: 'Vinyl', other: 'Other'};

const VINYL = /vinyl|\blp\b|(?<![\d.])(7|10|12)\s*(″|"|”|inch|in\b|吋|寸)|黑胶|レコード|アナログ/i;

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

export const isMedium = (v: string): v is Medium => (MEDIA as string[]).includes(v);
