import type {AlbumEntity, PackagingSpec as EntityPackagingSpec} from '@diedu/album-engine/schema';
import type {AlbumRecord, PackagingPhotoRole} from '../types';
import {albumPackaging, PACKAGING_PHOTO_ROLES} from './album-packaging';
import {albumTextureSource} from './album-model-assets';

/** The host owns legacy interpretation and private resource locations. */
export function toAlbumEntity(record: AlbumRecord): AlbumEntity {
  const model = albumPackaging(record.version, record.packaging);
  const packaging: EntityPackagingSpec = {
    structure: model.kind, thickness: model.thickness, panels: model.panels, pockets: model.pockets,
    pocketOpening: model.pocketOpening, holder: model.holder, tray: model.tray, discs: model.discs,
    finish: model.finish, miniLP: model.miniLP, slipcase: model.slipcase,
    ...(record.packaging?.size ? {size: {...record.packaging.size}} : {}),
  };
  const surfaces: AlbumEntity['surfaces'] = {};
  for (const {value: role} of PACKAGING_PHOTO_ROLES) {
    if (!albumTextureSource(record, role)) continue;
    const region = record.packaging?.photoRegions?.[role], rows = record.modelWarpRows?.[role],
      discCalibration = record.modelDiscCalibrations?.[role];
    surfaces[role] = {asset: 'surface:' + role, ...record.modelSources?.[role],
      ...(region ? {region: [...region]} : {}), ...(rows ? {warpRows: rows.map(row => [...row])} : {}),
      ...(discCalibration ? {discCalibration: structuredClone(discCalibration)} : {})};
  }
  return {schemaVersion: 1, key: record.id, title: record.title, packaging, surfaces,
    ...(record.modelAccessories?.length ? {components: record.modelAccessories.map(({source, ...part}) => ({...part, asset: source}))} : {}),
    placeholderHue: [...record.artist].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4 as 0 | 1 | 2 | 3,
    ...(record.modelCalibration ? {calibration: structuredClone(record.modelCalibration)} : {})};
}

export function resolveAlbumAsset(record: AlbumRecord, asset: string): string {
  if (record.modelAccessories?.some(item => item.source === asset)) return asset;
  if (!asset.startsWith('surface:')) return '';
  const role = asset.slice(8) as PackagingPhotoRole;
  return PACKAGING_PHOTO_ROLES.some(item => item.value === role) ? albumTextureSource(record, role) : '';
}
