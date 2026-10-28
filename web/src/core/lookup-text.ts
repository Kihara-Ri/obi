// 查询结果 → 一段整理好的文字，便于直接贴给 AI 询问这张专辑；只含资料库查到的事实与库里是否已有，不含价格等个人信息。
import type {ReleaseCandidate, ReleaseInfo} from '../types';
import {sourceName} from './release-source';
import {releaseLabels} from './release-text';
import {trackDiscs, trackDuration} from './tracklist';

// 照片可见情况 / 内圈刻码 / 附件是实物观察，资料库查询结果里没有，不进文字
const SKIP = new Set<keyof ReleaseInfo>(['observations', 'matrix', 'extras']);

export function releaseText(c: ReleaseCandidate, info: ReleaseInfo, owned = ''): string {
  const lines = [`${c.artist} - ${c.title}`];
  for (const [key, label] of releaseLabels) {
    const value = info[key];
    if (!SKIP.has(key) && typeof value === 'string' && value) lines.push(`${label}：${value}`);
  }
  lines.push(`资料来源：${sourceName(c.releaseInfo)}${c.url ? ' ' + c.url : ''}`);
  if (owned) lines.push(`我的收藏：${owned}`);
  const discs = trackDiscs(info);
  discs.forEach(disc => {
    lines.push('', discs.length > 1 ? `${disc.format || 'CD'} ${disc.position}` : '曲目');
    for (const t of disc.tracks) {
      const time = trackDuration(t.lengthMs);
      lines.push(`${t.position}. ${t.title}${time ? ` (${time})` : ''}`);
    }
  });
  return lines.join('\n');
}

/** 带一句提问：让 AI 介绍版本，并要求不确定处明说，避免编造。 */
export function askText(body: string): string {
  return '下面是我查到的一张 CD 发行版资料。请介绍这张专辑和这个具体版本（收录内容、与其他版次的区别、值不值得收），'
    + '不确定或资料里没有的地方请直接说明，不要编造。\n\n' + body;
}
