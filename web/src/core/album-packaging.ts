import type {PackagingPhotoRole, PackagingSpec} from '../types';

import {albumPackaging as explicitPackaging} from '../vendor/album-data/packaging';
import type {AlbumPackaging} from '../vendor/album-data/packaging';
export type {AlbumPackaging} from '../vendor/album-data/packaging';
export {packagingName} from '../vendor/album-data/packaging';

export const PACKAGING_PHOTO_ROLES: {value: PackagingPhotoRole; label: string}[] = [
  {value: 'front', label: '正面'}, {value: 'back', label: '背面'}, {value: 'spine', label: '外侧书脊'},
  {value: 'insideSpine', label: '内侧折脊'},
  {value: 'insideLeft', label: '左中面'}, {value: 'insideRight', label: '右中面'},
  {value: 'insideCenter', label: '第三折中面'}, {value: 'insideExtra', label: '第四折中面'},
  {value: 'disc', label: '盘面'}, {value: 'outer', label: 'Slipcase 外套'},
  {value: 'disc2', label: '盘面 2'}, {value: 'disc3', label: '盘面 3'}, {value: 'disc4', label: '盘面 4'},
];

export const PACKAGING_PRESETS: {value: string; label: string; spec: PackagingSpec}[] = [
  {value: 'jewel', label: 'Jewel Case', spec: {structure: 'jewel', thickness: 'standard'}},
  {value: 'slimline', label: 'Slimline Jewel Case', spec: {structure: 'jewel', thickness: 'slim'}},
  {value: 'multi', label: 'Multi-CD Jewel Case', spec: {structure: 'jewel', thickness: 'thick'}},
  {value: 'card-sleeve', label: 'Card Sleeve', spec: {structure: 'card-sleeve'}},
  {value: 'gatefold', label: 'Gatefold Sleeve', spec: {structure: 'gatefold', panels: 2}},
  {value: 'digisleeve', label: 'Digisleeve', spec: {structure: 'gatefold', panels: 3}},
  {value: 'digipak', label: 'Digipak', spec: {structure: 'digipak', panels: 2}},
  {value: 'digibook', label: 'Digibook', spec: {structure: 'digibook'}},
  {value: 'rigid-box', label: 'Rigid Box', spec: {structure: 'rigid-box'}},
  {value: 'mini-lp', label: 'Mini LP Sleeve', spec: {structure: 'card-sleeve', miniLP: true}},
];

function legacySpec(version: string): PackagingSpec {
  const text = version.normalize('NFKC').toLowerCase().trim().replace(/[‐‑‒–—−]/g, '-').replace(/\s+/g, ' ');
  const miniLP = /\bmini[\s-]*lp\b|ミニ[\s-]*lp/.test(text);
  const lp = miniLP ? {miniLP: true} : {};
  const slip = /\bslipcase\b|外[套盒]|スリーブケース/.test(text) ? {slipcase: true} : {};
  if (/硬[纸紙](?:板)?盒|厚(?:的)?[纸紙]盒|\brigid[\s-]*box\b|\bbox set\b/.test(text))
    return {...lp, ...slip, structure: 'rigid-box'};
  const plastic = /塑料盒|塑[胶膠]盒|透明盒|\bjewel[\s-]*case\b/.test(text);
  const gatefold = /\bgatefold\b|見開き|对折|對折|ダブル.*紙|紙.*ダブル/.test(text);
  const sleeve = /\bcard[\s-]*sleeve\b|\bpaper[\s-]*(sleeve|jacket)\b|单口|單口|シングル.*紙|紙.*シングル/.test(text);
  const digipak = /\bdigi[\s-]*pa(?:c)?k\b/.test(text);
  if (plastic && (gatefold || sleeve || digipak)) return {...lp, ...slip};
  if (plastic) {
    // Disc count does not imply a thicker case; ordinary cases can have a swing tray.
    const thickness = /厚|\bfat[\s-]*box\b|\bthick\b|\bmulti[\s-]*cd\b/.test(text) ? 'thick'
      : /薄|\bslim(?:line)?\b/.test(text) ? 'slim' : 'standard';
    const discs = /[双雙]碟|\b(?:2|double)[\s-]*(?:cd|disc)\b/.test(text) ? 2 : 1;
    return {...slip, structure: 'jewel', thickness, discs};
  }
  if (/\bdigibook\b/.test(text)) return {...lp, ...slip, structure: 'digibook'};
  const panelCount = /\b([468])[\s-]*panel\b/.exec(text);
  const panels = panelCount ? Number(panelCount[1]) / 2 as 2 | 3 | 4 : /三折|tri[\s-]*fold/.test(text) ? 3 : 2;
  if (digipak) return {...lp, ...slip, structure: 'digipak', panels};
  if (gatefold || /\bdigisleeve\b/.test(text)) return {...lp, ...slip, structure: 'gatefold', panels};
  if (sleeve || /\bmini[\s-]*lp[\s-]*sleeve\b/.test(text)) return {...lp, ...slip, structure: 'card-sleeve'};
  // 紙ジャケット and Mini LP alone describe a family/style, not the pocket/folding structure.
  return {...lp, ...slip};
}

/** The host retains interpretation of legacy ledger labels. */
export function albumPackaging(version: string, spec?: PackagingSpec | null): AlbumPackaging {
  return explicitPackaging({...legacySpec(version), ...spec});
}

export function formatPackagingName(version: string, spec?: PackagingSpec | null): string {
  if (spec?.structure === 'unknown') return '待核对';
  return albumPackaging(version, spec).label || version;
}

export function packagingPreset(version: string, spec?: PackagingSpec | null): string {
  const model = albumPackaging(version, spec);
  if (model.kind === 'unknown') return version || spec?.structure === 'unknown' ? '__custom' : '__none';
  if (model.kind === 'jewel') return model.label.startsWith('Slimline') ? 'slimline'
    : model.label.startsWith('Multi-CD') ? 'multi' : 'jewel';
  if (model.kind === 'card-sleeve' && model.miniLP) return 'mini-lp';
  if (model.kind === 'gatefold') return model.panels > 2 ? 'digisleeve' : 'gatefold';
  return model.kind;
}

export function packagingSuggestions(version: string): typeof PACKAGING_PRESETS {
  if (albumPackaging(version).kind !== 'unknown' || !/[纸紙]|mini[\s-]*lp|ミニ|ジャケ/i.test(version)) return [];
  return PACKAGING_PRESETS.filter(p => ['card-sleeve', 'gatefold', 'digisleeve', 'digipak', 'rigid-box'].includes(p.value));
}

/** Preserve source photo identity when the editor removes/reorders existing photo slots. */
export function remapPackagingPhotos(spec: PackagingSpec | null | undefined, entries: (number | string)[]): PackagingSpec | null {
  if (!spec) return null;
  const photos: PackagingSpec['photos'] = {};
  const regions: PackagingSpec['photoRegions'] = {};
  for (const {value: role} of PACKAGING_PHOTO_ROLES) {
    const old = spec.photos?.[role];
    const next = old === undefined ? -1 : entries.indexOf(old);
    if (next >= 0) photos[role] = next;
    // Front may refer to the cover without a photo slot. All other regions follow
    // the mapped source photo, and a deleted mapped front must not crop the cover.
    if (spec.photoRegions?.[role] && (next >= 0 || role === 'front' && old === undefined))
      regions[role] = spec.photoRegions[role];
  }
  return {...spec, photos, ...(spec.photoRegions ? {photoRegions: regions} : {})};
}

/** Selecting a new source (including the cover fallback) removes its old projection. */
export function setPackagingPhoto(spec: PackagingSpec | null | undefined, role: PackagingPhotoRole,
  index: number | undefined): PackagingSpec {
  const photos = {...spec?.photos};
  if (index === undefined) delete photos[role]; else photos[role] = index;
  const result = {...spec, photos};
  if (spec?.photoRegions) {
    result.photoRegions = {...spec.photoRegions}; delete result.photoRegions[role];
  }
  return result;
}
