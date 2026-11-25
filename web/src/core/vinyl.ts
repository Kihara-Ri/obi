// 黑胶副本（D-055）：包装预设只存英文术语、不带 3D 结构；尺寸 / 转速 / 彩胶 / 品相存在副本的 vinyl 字段。
// 字段与服务端 domain.clean_vinyl 对齐；尺寸没填时从发行资料的格式（12" Vinyl）认。
import type {ReleaseInfo} from '../types';

export type VinylSize = '7' | '10' | '12';
export type VinylSpeed = '33' | '45' | '78';
export type Grade = 'M' | 'NM' | 'VG+' | 'VG' | 'G';
export interface VinylSpec {
  size?: VinylSize; speed?: VinylSpeed; color?: string;
  /** 唱片 / 封套品相（Goldmine 分级）；不填就是没评 */
  mediaGrade?: Grade; sleeveGrade?: Grade;
}

export const VINYL_SIZES: VinylSize[] = ['7', '10', '12'];
export const VINYL_SPEEDS: {value: VinylSpeed; label: string}[] = [
  {value: '33', label: '33⅓'}, {value: '45', label: '45'}, {value: '78', label: '78'}];
export const GRADES: {value: Grade; label: string; hint: string}[] = [
  {value: 'M', label: 'M', hint: '全新未拆'}, {value: 'NM', label: 'NM', hint: '近全新'},
  {value: 'VG+', label: 'VG+', hint: '轻微使用痕迹'}, {value: 'VG', label: 'VG', hint: '明显痕迹，可听'},
  {value: 'G', label: 'G', hint: '磨损重'},
];

/** 黑胶包装预设：value 是图标与中文名的键，label 是存储的英文术语 */
export const VINYL_PACKAGING: {value: string; label: string; zh: string}[] = [
  {value: 'lp-single', label: 'Single Jacket', zh: '单封套'},
  {value: 'lp-gatefold', label: 'Gatefold Jacket', zh: '对开封套'},
  {value: 'lp-box', label: 'Box Set', zh: '套装盒'},
];

/** 文字是否为黑胶包装预设；返回预设 value 或 '' */
export function vinylPackagingKind(text: string): string {
  const t = text.normalize('NFKC').trim().toLowerCase();
  return VINYL_PACKAGING.find(p => p.label.toLowerCase() === t)?.value ?? '';
}

/** 资料库的包装名 → 黑胶预设术语；认不出返回 ''（让用户自己选） */
export function vinylPackagingFromCatalog(text: string): string {
  const t = text.normalize('NFKC').trim().toLowerCase();
  if (!t) return '';
  const preset = VINYL_PACKAGING.find(p => p.label.toLowerCase() === t);
  if (preset) return preset.label;
  if (/gatefold/.test(t)) return 'Gatefold Jacket';
  if (/\bbox\b/.test(t)) return 'Box Set';
  if (/sleeve|jacket|cardboard/.test(t)) return 'Single Jacket';
  return '';
}

/** 从格式文字认尺寸：12" Vinyl → '12' */
export function formatSize(info?: Partial<ReleaseInfo> | null): VinylSize | '' {
  const text = [info?.format, ...(info?.media ?? []).map(m => m.format)].join(' ');
  const hit = /(?<![\d.])(7|10|12)\s*(?:″|"|”|inch|in\b|吋|寸)/i.exec(text);
  return (hit?.[1] as VinylSize) ?? '';
}

/** 实际尺寸：副本填写的优先，没填从格式认 */
export const vinylSize = (spec?: VinylSpec | null, info?: Partial<ReleaseInfo> | null): VinylSize | '' =>
  spec?.size || formatSize(info);

const speedLabel = (s?: VinylSpeed) => VINYL_SPEEDS.find(x => x.value === s)?.label ?? '';

/** 规格一行：12″ · 33⅓ 转 · 彩胶（红） */
export function vinylSpecText(spec?: VinylSpec | null, info?: Partial<ReleaseInfo> | null): string {
  const size = vinylSize(spec, info);
  return [size && `${size}″`, spec?.speed && `${speedLabel(spec.speed)} 转`,
    spec?.color && `彩胶（${spec.color}）`].filter(Boolean).join(' · ');
}

/** 品相一行：唱片 NM / 封套 VG+；都没评返回 '' */
export function gradeText(spec?: VinylSpec | null): string {
  return [spec?.mediaGrade && `唱片 ${spec.mediaGrade}`, spec?.sleeveGrade && `封套 ${spec.sleeveGrade}`]
    .filter(Boolean).join(' / ');
}

/** 列表标签：12″ 黑胶（尺寸不明时只写黑胶） */
export const vinylTag = (spec?: VinylSpec | null, info?: Partial<ReleaseInfo> | null): string => {
  const size = vinylSize(spec, info);
  return size ? `${size}″ 黑胶` : '黑胶';
};

/** 去掉空项；全空返回 null（保存时不写字段） */
export function cleanVinyl(spec?: VinylSpec | null): VinylSpec | null {
  if (!spec) return null;
  const out = Object.fromEntries(Object.entries(spec).filter(([, v]) => typeof v === 'string' && v.trim())
    .map(([k, v]) => [k, (v as string).trim()])) as VinylSpec;
  return Object.keys(out).length ? out : null;
}
