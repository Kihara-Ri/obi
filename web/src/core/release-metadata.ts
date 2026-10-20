/** MusicBrainz sometimes brackets an editorially supplied release title. */
export function displayReleaseTitle(raw: string): string {
  const title = raw.trim();
  return /^\[[^\[\]]+\]$/.test(title) ? title.slice(1, -1).trim() : title;
}

/** JP/non-JP is the existing copy classification; retain the real country code in storage. */
export function releaseRegion(country?: string, oldPressing?: string): string {
  const code = (country || '').trim().toUpperCase();
  if (code) return code === 'JP' ? '日版' : '外版';
  return oldPressing === '日版' || oldPressing === '外版' ? oldPressing : '';
}

const REGION_NAMES: Record<string, string> = {
  JP: '日本', US: '美国', GB: '英国', UK: '英国', DE: '德国', FR: '法国', IT: '意大利', ES: '西班牙', NL: '荷兰',
  SE: '瑞典', NO: '挪威', DK: '丹麦', FI: '芬兰', AT: '奥地利', BE: '比利时', CH: '瑞士', IE: '爱尔兰', PT: '葡萄牙',
  PL: '波兰', CZ: '捷克', HU: '匈牙利', GR: '希腊', TR: '土耳其', RU: '俄罗斯', IL: '以色列', ZA: '南非',
  CA: '加拿大', MX: '墨西哥', BR: '巴西', AR: '阿根廷', AU: '澳大利亚', NZ: '新西兰',
  CN: '中国', HK: '中国香港', TW: '中国台湾', KR: '韩国', SG: '新加坡', TH: '泰国', MY: '马来西亚',
  ID: '印度尼西亚', PH: '菲律宾', IN: '印度', XE: '欧洲', XW: '全球', XU: '未知地区',
};
/** 发行地区代码 → 中文地区名；不在表里的原样显示代码（不丢信息）。 */
export function regionName(country?: string): string {
  const code = (country || '').trim().toUpperCase();
  return REGION_NAMES[code] ?? code;
}
/** 列表 / 标签里的地区：已经由发行版确定国家的显示地区名（美国、日本…），否则退回旧的日版 / 外版。 */
export function displayRegion(country?: string, oldPressing?: string): string {
  return regionName(country) || releaseRegion(undefined, oldPressing);
}

/** Display art may be from a digital album but it must be a true title and
 * artist match. Never silently replace it with a fuzzy or CAA group result. */
export function exactDigitalCover<T extends {exact: boolean; provider?: string}>(choices: T[]): T | undefined {
  return choices.find(choice => choice.exact && choice.provider === 'iTunes');
}

/** 资料库的唱片编号常被重复拼接（A / A / A）：去重后最多显示两个，其余折成 +N。 */
export function dedupeCatalog(raw?: string): string {
  const parts = [...new Set((raw ?? '').split('/').map(x => x.trim()).filter(Boolean))];
  return parts.length > 2 ? `${parts.slice(0, 2).join(' / ')} +${parts.length - 2}` : parts.join(' / ');
}
