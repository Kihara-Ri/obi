// 发行资料字段标签（原 core/recognition.ts；AI 照片识别已移除，只剩这张标签表）。
import type {ReleaseInfo} from '../types';

export const releaseLabels: [keyof ReleaseInfo, string][] = [
  ['catalogNumber','唱片编号'], ['barcode','条码'], ['label','厂牌'], ['country','发行地区'],
  ['releaseDate','本版发行日期'], ['packaging','包装'], ['edition','版次 / 版本说明'], ['format','介质'], ['discCount','碟数'],
  ['matrix','内圈刻码'], ['extras','可见附件与特典'], ['observations','照片可见情况'],
];
