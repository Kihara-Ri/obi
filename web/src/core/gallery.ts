import type {AlbumRecord} from '../types';
import {searchScore} from './search';

export type GalleryMode = 'tiles' | 'waterfall' | 'film' | 'flow' | 'crate' | 'table' | 'fan' | 'isometric' | 'ring';
export const GALLERY_ROAMING_DEFAULTS: Readonly<Record<GalleryMode, number>> = {
  tiles: 8, waterfall: 10, film: 6, flow: 4, crate: 5,
  table: 10, fan: 4, isometric: 4, ring: 4,
};
/** 巡游档位：所有布局共用一个倍率，「标准」= 各布局的默认秒数（GALLERY_ROAMING_DEFAULTS）。 */
export type GalleryRoamingPace = 'slowest' | 'slow' | 'normal' | 'fast' | 'fastest';
export const GALLERY_ROAMING_PACES: ReadonlyArray<{value: GalleryRoamingPace; label: string; factor: number}> = [
  {value: 'slowest', label: '很慢', factor: .5}, {value: 'slow', label: '慢', factor: .75},
  {value: 'normal', label: '标准', factor: 1}, {value: 'fast', label: '快', factor: 1.5},
  {value: 'fastest', label: '很快', factor: 2},
];
const paceFactor = (pace: GalleryRoamingPace) => GALLERY_ROAMING_PACES.find(p => p.value === pace)?.factor ?? 1;
/** 档位换算成布局自己的秒数：中心布局为每张停留，连续布局为秒/张，等距为秒/排。 */
export function galleryRoamingSeconds(mode: GalleryMode, pace: GalleryRoamingPace): number {
  return GALLERY_ROAMING_DEFAULTS[mode] / paceFactor(pace);
}
/** 旧版按布局保存的 2–30 秒，换算成倍率最接近的档位。 */
function nearestPace(mode: GalleryMode, seconds: number): GalleryRoamingPace {
  const factor = GALLERY_ROAMING_DEFAULTS[mode] / seconds;
  return GALLERY_ROAMING_PACES.reduce((best, p) =>
    Math.abs(Math.log(p.factor / factor)) < Math.abs(Math.log(best.factor / factor)) ? p : best).value;
}
export type GalleryAxis = 'vertical' | 'horizontal';
/** 滑动方向只对这两种自然铺开的布局有意义；其余布局的轨道方向由各自的造型决定。 */
export const galleryHasAxis = (mode: GalleryMode): boolean => mode === 'tiles' || mode === 'waterfall';
export type GalleryDensity = 'small' | 'medium' | 'large';
/** 封面墙 / 瀑布流里专辑之间的间距：在默认间距上缩放（none = 贴紧） */
export type GallerySpacing = 'none' | 'tight' | 'normal' | 'wide';
export const GALLERY_SPACING_SCALE: Record<GallerySpacing, number> = {none: 0, tight: .5, normal: 1, wide: 1.8};
export type GallerySort = 'recent' | 'artist' | 'title' | 'group';
export type GalleryScope = {kind: 'all'} | {kind: 'favorites'} | {kind: 'artist'; artist: string} | {kind: 'group'; groupId: string};
export interface ShowcaseGroup {id: string; name: string; recordIds: string[]}
export interface ShowcaseGroups {revision: number; groups: ShowcaseGroup[]}

export function showcaseGroups(settings: Record<string, unknown>): ShowcaseGroups {
  const raw = settings['showcase-groups-v1'];
  if (!raw || typeof raw !== 'object') return {revision: 0, groups: []};
  const store = raw as Partial<ShowcaseGroups>;
  if (!Number.isInteger(store.revision) || !Array.isArray(store.groups)) return {revision: 0, groups: []};
  return {revision: store.revision!, groups: store.groups.filter(g => g && typeof g.id === 'string'
    && typeof g.name === 'string' && Array.isArray(g.recordIds) && g.recordIds.every(id => typeof id === 'string'))};
}

export const GALLERY_MODES: ReadonlyArray<{value: GalleryMode; label: string; description: string}> = [
  {value: 'tiles', label: '封面墙', description: '像瓷砖一样铺开全部收藏'},
  {value: 'waterfall', label: '瀑布流', description: '错落纵列，标题随封面排列'},
  {value: 'film', label: '胶片', description: '自由滑动胶片，停在任何位置'},
  {value: 'flow', label: '翻阅', description: '当前封面居中，两侧向后展开'},
  {value: 'crate', label: '唱片箱', description: '像从唱片箱中翻出下一张'},
  {value: 'table', label: '桌面铺开', description: '自然散落在桌面，连续向下铺开'},
  {value: 'fan', label: '扇形展开', description: '封面围绕底部支点展开'},
  {value: 'isometric', label: '等距封面墙', description: '沿斜向轨道循环浏览'},
  {value: 'ring', label: '环形展架', description: '沿弧形展架转到下一张'},
];

/** 四个中心模式围绕当前封面沿连续轨道排列。 */
export function galleryModeHasFocus(mode: GalleryMode): boolean {
  return ['flow', 'crate', 'fan', 'ring'].includes(mode);
}

export interface GalleryPreferences {
  mode: GalleryMode;
  density: GalleryDensity;
  spacing: GallerySpacing;
  axis: GalleryAxis;
  showTitles: boolean;
  sort: GallerySort;
  currentId: string | null;
  scope: GalleryScope;
  roamingPace: GalleryRoamingPace;
}

const PREF_KEY = 'album-gallery-v1';

export function readGalleryPreferences(): GalleryPreferences {
  const fallback: GalleryPreferences = {
    mode: 'tiles', density: 'medium', spacing: 'normal', axis: 'vertical', showTitles: false,
    sort: 'recent', currentId: null, scope: {kind: 'all'}, roamingPace: 'normal',
  };
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || 'null') as Partial<GalleryPreferences> | null;
    if (!p || typeof p !== 'object') return fallback;
    const mode = GALLERY_MODES.some(m => m.value === p.mode) ? p.mode! : fallback.mode;
    // 旧偏好 roamingSpeeds（按布局的秒数）只在没有档位时用当前布局那一项迁移，不再写回。
    const legacy = (p as {roamingSpeeds?: Partial<Record<GalleryMode, unknown>>}).roamingSpeeds?.[mode];
    const roamingPace: GalleryRoamingPace = GALLERY_ROAMING_PACES.some(x => x.value === p.roamingPace) ? p.roamingPace!
      : typeof legacy === 'number' && Number.isInteger(legacy) && legacy >= 2 && legacy <= 30 ? nearestPace(mode, legacy)
        : 'normal';
    return {
      roamingPace, mode,
      density: ['small', 'medium', 'large'].includes(p.density || '') ? p.density! : fallback.density,
      spacing: p.spacing && p.spacing in GALLERY_SPACING_SCALE ? p.spacing : fallback.spacing,
      axis: p.axis === 'horizontal' ? 'horizontal' : 'vertical',
      showTitles: typeof p.showTitles === 'boolean' ? p.showTitles : fallback.showTitles,
      sort: ['recent', 'artist', 'title', 'group'].includes(p.sort || '') ? p.sort! : fallback.sort,
      currentId: typeof p.currentId === 'string' ? p.currentId : null,
      scope: p.scope?.kind === 'favorites' ? {kind: 'favorites'}
        : p.scope?.kind === 'artist' && typeof p.scope.artist === 'string' ? {kind: 'artist', artist: p.scope.artist}
          : p.scope?.kind === 'group' && typeof p.scope.groupId === 'string' ? {kind: 'group', groupId: p.scope.groupId}
            : {kind: 'all'},
    };
  } catch { return fallback; }
}

export function saveGalleryPreferences(p: GalleryPreferences): void {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); }
  catch { /* 浏览器不允许保存偏好时，本次展示仍可使用。 */ }
}

/** 在途仍属于自己的收藏；成交即进入 shipping，回收站也不参与展示。 */
export function isCollectedRecord(record: AlbumRecord): boolean {
  return record.status === 'domestic' || record.status === 'overseas' || record.status === 'transit';
}

/** 一张实物一条结果，上架状态与是否有封面都不改变收藏范围。 */
export function galleryRecords(records: AlbumRecord[], query: string, sort: GallerySort,
                               scope: GalleryScope = {kind: 'all'}, groups: ShowcaseGroup[] = [],
                               favorites: Readonly<Record<string, boolean>> = {}): AlbumRecord[] {
  const q = query.trim().toLocaleLowerCase();
  const group = scope.kind === 'group' ? groups.find(g => g.id === scope.groupId) : undefined;
  const members = new Map(group?.recordIds.map((id, i) => [id, i]) ?? []);
  const eligible = records.filter(r => isCollectedRecord(r)
    && (scope.kind === 'all' || scope.kind === 'favorites' && favorites[r.id] === true
      || scope.kind === 'artist' && r.artist.trim() === scope.artist
      || scope.kind === 'group' && members.has(r.id)));
  const filtered = q ? eligible.filter(r => searchScore(r, q) > 0) : eligible;
  return filtered.sort((a, b) => {
    if (sort === 'group' && group) return members.get(a.id)! - members.get(b.id)!;
    const order = sort === 'artist'
      ? a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title)
      : sort === 'title' ? a.title.localeCompare(b.title) || a.artist.localeCompare(b.artist)
        : b.createdAt.localeCompare(a.createdAt);
    return order || a.id.localeCompare(b.id);
  });
}

/** 由副本 ID 得到稳定的非负整数：同一张每次的散落角度 / 错落档位都一样。 */
export function galleryHash(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (Math.imul(hash, 31) + id.charCodeAt(i)) | 0;
  return hash >>> 0;
}

export function galleryIndex(records: AlbumRecord[], currentId: string | null): number {
  const found = records.findIndex(r => r.id === currentId);
  return found < 0 ? 0 : found;
}
