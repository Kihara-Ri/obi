// 「更新说明」：从随包的 CHANGELOG.md 里取出用户上次看过的版本之后的条目。
// 记住的是「已展示到哪一版」（localStorage）；首次安装只记录不弹。
const KEY = 'obi-seen-version';
const MAX = 4;   // 一次最多列几个版本，久未打开的用户只看最近几版

export interface ReleaseNote {version: string; date: string; items: string[]}

const nums = (v: string) => (/^v?(\d+)\.(\d+)\.(\d+)/.exec(v) ?? []).slice(1).map(Number);
const newer = (a: string, b: string) => {
  const x = nums(a), y = nums(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

export function parseChangelog(text: string): ReleaseNote[] {
  const notes: ReleaseNote[] = [];
  for (const block of text.split(/^## /m).slice(1)) {
    const [head, ...lines] = block.split('\n');
    const m = /^(v\d+\.\d+\.\d+)(?:[（(]([^）)]*)[）)])?/.exec(head.trim());
    if (!m) continue;
    const items = lines.filter(l => l.startsWith('- ')).map(l => l.slice(2).replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]*)\*\*/g, '$1').trim());
    if (items.length) notes.push({version: m[1], date: m[2] ?? '', items});
  }
  return notes;
}

const read = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const markSeen = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* 无痕等环境：下次再提示也无妨 */ } };

/** 需要弹出的更新说明；无需弹（首次、版本未变、dev）返回 []，首次会顺手记下当前版本 */
export function unseenNotes(current: string | undefined, notes: ReleaseNote[]): ReleaseNote[] {
  if (!current || !nums(current).length) return [];
  const seen = read();
  if (!seen) { markSeen(current); return []; }
  if (!newer(current, seen)) return [];
  return notes.filter(n => newer(n.version, seen) && !newer(n.version, current)).slice(0, MAX);
}
