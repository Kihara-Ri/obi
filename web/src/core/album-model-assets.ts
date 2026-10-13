import type {AlbumRecord, PackagingPhotoRole} from '../types';
import type {AlbumPackaging} from './album-packaging';

import {albumModelAsset as engineModelAsset} from '@diedu/album-engine/packaging';
export {albumPanelDiscs} from '@diedu/album-engine/packaging';

export function albumModelAsset(model: AlbumPackaging, calibrated = false): string {
  return engineModelAsset(model, calibrated, {baseUrl:'/models/packaging/',rigVersion:1});
}

/** A specified but unavailable front photograph must not become a different cover. */
export function albumTextureSource(record: AlbumRecord, role: PackagingPhotoRole): string {
  if (record.modelTextures) return record.modelTextures[role] ?? '';
  const index = record.packaging?.photos?.[role];
  if (index !== undefined) return index >= 0 && index < record.photoCount
    ? '/api/photo/' + record.id + '/' + index + '?v=' + record.revision : '';
  return role === 'front' ? record.cover : '';
}
