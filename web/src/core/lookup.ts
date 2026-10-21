// 条码 / 唱片编号查询的纯逻辑：输入识别、条码校验位、本地库命中、最近查询（只存本浏览器）。
import {prefs} from './prefs';
import type {AlbumRecord} from '../types';

export type LookupKind = 'barcode' | 'catalog';
export type Classified = {ok: true; kind: LookupKind; value: string} | {ok: false; error: string};

const BARCODE_LENGTHS = new Set([8, 12, 13, 14]);

/** GS1 校验位：自右向左（不含校验位）按 3、1 交替加权，和补足到 10 的倍数。 */
export function gs1Valid(digits: string): boolean {
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += Number(body[body.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - sum % 10) % 10 === Number(digits.slice(-1));
}

const compact = (value: string) => value.replace(/[\s\-]/g, '');
export const normalizeCatno = (value: string) => value.replace(/[^\w]/g, '').toLowerCase();

/** 一个输入框自动识别：8/12/13/14 位纯数字按条码（并校验校验位），其余按唱片编号。 */
export function classify(raw: string): Classified {
  const text = raw.trim();
  if (!text) return {ok: false, error: '请输入条码或唱片编号'};
  const digits = compact(text);
  if (/^\d+$/.test(digits) && BARCODE_LENGTHS.has(digits.length)) {
    return gs1Valid(digits) ? {ok: true, kind: 'barcode', value: digits}
      : {ok: false, error: '条码校验位不对，请核对是否输错了一位'};
  }
  if (text.length < 2 || text.length > 80) return {ok: false, error: '唱片编号需 2–80 个字符'};
  if (!/^[\w ./+\-]+$/u.test(text)) return {ok: false, error: '唱片编号包含不支持的字符'};
  return {ok: true, kind: 'catalog', value: text};
}

/** 查询页专用：是否按文字（专辑名 / 艺人名）搜索。条码与专辑表单不走这里，仍只用 classify。
 *  有非编号字符、或没有数字（编号几乎都带数字）、或词太多，都视为文字；单个带连字符的词仍按编号。 */
export function isTextQuery(raw: string): boolean {
  const text = raw.trim();
  if (!text || (/^[\d\s\-]+$/.test(text) && BARCODE_LENGTHS.has(compact(text).length))) return false;
  if (!/^[\w ./+\-]+$/.test(text) || /[^\x00-\x7f]/.test(text)) return true;
  const tokens = text.split(/\s+/);
  if (!/\d/.test(text)) return !(tokens.length === 1 && text.includes('-'));
  return tokens.length > 2 || text.length > 20;
}

const plain = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** 文字搜索结果里，库里已有的同名专辑（标题一致，艺人互相包含）。 */
export function ownedAlbums(records: AlbumRecord[], title: string, artist: string): AlbumRecord[] {
  const t = plain(title), a = plain(artist);
  return !t ? [] : records.filter(r => plain(r.title) === t && (!a || !plain(r.artist) || plain(r.artist).includes(a) || a.includes(plain(r.artist))));
}

/** 本地库里已有的同条码 / 同编号记录（含已售出与回收站，状态由调用方展示）。 */
export function localMatches(records: AlbumRecord[], kind: LookupKind, value: string): AlbumRecord[] {
  return records.filter(r => {
    const info = r.releaseInfo;
    if (!info) return false;
    if (kind === 'barcode') return (info.barcode || '').replace(/\D/g, '') === value;
    const wanted = normalizeCatno(value);
    return !!wanted && (info.catalogNumber || '').split(' / ').some(part => normalizeCatno(part) === wanted);
  });
}

const RECENT_KEY = 'lookup-recent';
const RECENT_MAX = 8;

export function loadRecent(): string[] {
  try {
    const list = JSON.parse(prefs.get(RECENT_KEY, '[]'));
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch { return []; }
}

export function saveRecent(list: string[]): void {
  try { prefs.set(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX))); } catch { /* 隐私模式等：不影响查询 */ }
}

export const pushRecent = (list: string[], value: string) =>
  [value, ...list.filter(x => x !== value)].slice(0, RECENT_MAX);
