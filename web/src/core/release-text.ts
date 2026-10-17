// 发行资料标签与上架描述文字（原 core/recognition.ts；AI 照片识别已移除，只剩这两个纯文本工具）。
import type {ListingFields, ReleaseInfo, PackagingSpec} from '../types';
import {formatPackagingName} from './album-packaging';

export const releaseLabels: [keyof ReleaseInfo, string][] = [
  ['catalogNumber','唱片编号'], ['barcode','条码'], ['label','厂牌'], ['country','发行地区'],
  ['releaseDate','本版发行日期'], ['packaging','包装'], ['edition','版次 / 版本说明'], ['format','介质'], ['discCount','碟数'],
  ['matrix','内圈刻码'], ['extras','可见附件与特典'], ['observations','照片可见情况'],
];

export function listingText(fields: ListingFields & {packaging?: PackagingSpec | null}): string {
  const r = fields.releaseInfo ?? {};
  const lines = [[fields.artist, fields.title].filter(Boolean).join(' ')];
  for (const [label, value] of [['包装',formatPackagingName(fields.version ?? '', fields.packaging)],['版次',fields.pressing],['侧标',fields.obi]])
    if (value) lines.push(`${label}：${value}`);
  for (const [key,label] of releaseLabels) if (r[key]) lines.push(`${label}：${r[key]}`);
  return lines.filter(Boolean).join('\n');
}
