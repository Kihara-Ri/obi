// 购买渠道的归并与品牌分组（纯函数，便于单测）。
// 归并：同店不同写法合并（Disk union / disk union、SHIBUYA 109 / SHIBUYA109…），键为小写去空白，展示名取出现最多的写法，
// 按归并后的总购买次数降序。分组见 groupShops 上方说明。
export type Shop = {name: string; count: number};
export type Group = {key: string; label: string; shops: Shop[]; total: number; aliases: string[]};

export const normShop = (s: string) => s.toLocaleLowerCase().replace(/[\s\u3000]+/g, '');

export function mergeShops(locations: string[], defaultShop: string): Shop[] {
  const groups = new Map<string, {spell: Map<string, number>; total: number}>();
  const add = (s: string, n: number) => {
    if (!s) return;
    const k = normShop(s);
    let g = groups.get(k);
    if (!g) { g = {spell: new Map(), total: 0}; groups.set(k, g); }
    g.spell.set(s, (g.spell.get(s) || 0) + n);
    g.total += n;
  };
  locations.forEach(l => add((l || '').trim(), 1));
  if (defaultShop && !groups.has(normShop(defaultShop.trim()))) add(defaultShop.trim(), 0);
  return [...groups.values()].map(g => {
    let name = '', best = -1;
    for (const [s, c] of g.spell) if (c > best) { name = s; best = c; }
    return {name, count: g.total};
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}

// 品牌分组。名称先压缩（去空白 / 连字符 / 点 / 中点、转小写）再比较，所以「Book Off」「BOOKOFF」「ブックオフ」同属一家。
//  1. 已知连锁（有内置图标的）按别名归组，一级标签用规范品牌名（BOOKOFF、Disk Union…），不用任何一家分店名；
//  2. 其余店名按公共前缀归组（英文数字 ≥4 个字符、其他文字 ≥3 个字符），一级标签取公共前缀；
//  3. 只有一家的品牌不成组，直接作为一个标签。
const BRAND_LABELS: Record<string, string> = {
  amazon: 'Amazon', rakuten: '楽天', yahoo: 'Yahoo!', mercari: 'メルカリ', bookoff: 'BOOKOFF', xianyu: '闲鱼',
  paypay: 'PayPay', diskunion: 'Disk Union', surugaya: '駿河屋', meditations: 'Meditations', recofan: 'レコファン',
  tower: 'Tower Records', 淘宝: '淘宝', junkudo: '丸善ジュンク堂',
};
export const squash = (s: string) => s.toLocaleLowerCase().replace(/[\s\u3000\-_.・·]/g, '');
type Brand = {key: string; aliases: string[]};
/** 把 'diskunion|disk union|ディスクユニオン' 这类关键词串（内置图标表的键）转成品牌别名表。 */
export const brandsFromKeys = (keys: string[]): Brand[] => keys.map(k => {
  const list = k.split('|').map(squash);
  return {key: list[0], aliases: list};
});
const brandOf = (brands: Brand[], name: string) => {
  const c = squash(name);
  return brands.find(b => b.aliases.some(a => c.includes(a))) ?? null;
};
const prefixLen = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};
const longEnough = (prefix: string) => /^[a-z0-9]+$/.test(prefix) ? prefix.length >= 4 : prefix.length >= 3;

export function groupShops(shops: Shop[], brands: Brand[]): Group[] {
  const parent = shops.map((_, i) => i);
  const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const known = shops.map(s => brandOf(brands, s.name));
  const squashed = shops.map(s => squash(s.name));
  for (let i = 0; i < shops.length; i++) for (let j = i + 1; j < shops.length; j++) {
    const sameBrand = known[i] && known[i] === known[j];
    const bothUnknown = !known[i] && !known[j];
    if (sameBrand || (bothUnknown && longEnough(squashed[i].slice(0, prefixLen(squashed[i], squashed[j]))))) {
      parent[find(i)] = find(j);
    }
  }
  const buckets = new Map<number, number[]>();
  shops.forEach((_, i) => buckets.set(find(i), [...(buckets.get(find(i)) ?? []), i]));
  const groups: Group[] = [];
  for (const idx of buckets.values()) {
    const list = idx.map(i => shops[i]);
    if (list.length < 2) { groups.push({key: 'one:' + list[0].name, label: list[0].name, shops: list, total: list[0].count, aliases: []}); continue; }
    const brand = known[idx[0]];
    // 公共前缀：按原写法逐字比较（不分大小写），修掉末尾的空白 / 标点；取不出合格前缀时退回最短店名的首词
    const label = brand ? BRAND_LABELS[brand.key] ?? list[0].name : (() => {
      const lower = list.map(s => s.name.toLocaleLowerCase());
      const n = lower.reduce((m, s) => Math.min(m, prefixLen(lower[0], s)), lower[0].length);
      const prefix = list[0].name.slice(0, n).replace(/[\s\u3000\-_.・·(（]+$/, '');
      return longEnough(squash(prefix)) ? prefix : list.map(s => s.name).sort((a, b) => a.length - b.length)[0].split(/[\s\u3000]/)[0];
    })();
    groups.push({key: brand ? 'brand:' + brand.key : 'pre:' + squash(label), label, shops: list,
      total: list.reduce((n, s) => n + s.count, 0), aliases: brand ? [...new Set([...brand.aliases, squash(label)])] : [squash(label)]});
  }
  return groups.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'zh'));
}
// 分店标签去掉品牌前缀（「Disk union 下北沢店」→「下北沢店」）：逐字走到压缩后等于任一别名为止。
// 例外：网址型店名（tower.jp、Amazon.co.jp）是独立的线上店，去掉前缀会剩下「jp」，一律保留全名；
// 去掉后不足 2 个字符也保留全名；店名恰好就是品牌名（没写分店）的历史记录显示为「未指定」。
export const branchLabel = (name: string, aliases: string[]) => {
  if (/\.[a-z]{2,}/i.test(name)) return name;
  let c = '', end = -1;
  for (let i = 0; i < name.length; i++) {
    c += squash(name[i]);
    if (c && aliases.includes(c)) end = i; // 取最长的别名命中（Tower / Tower Records 都是别名时去掉整个「Tower Records」）
  }
  if (end < 0) return name;
  const rest = name.slice(end + 1).replace(/^[\s\u3000・·\-－:：.]+/, '');
  if (!rest) return '未指定';
  return [...rest].length < 2 ? name : rest;
};

