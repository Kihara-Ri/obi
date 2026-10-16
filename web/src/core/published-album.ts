import type {AlbumDocument, AlbumEntity, AssetResolver} from '@diedu/album-engine/schema';
import {inspectAlbum} from '@diedu/album-engine/capabilities';
import type {AlbumRecord, TwinJob} from '../types';

/** Business eligibility and private URL authorization only; geometry belongs to the engine. */
export function publishedAlbum(record: AlbumRecord, job?: TwinJob): {entity: AlbumDocument; resolveAsset: AssetResolver} | null {
  if (job?.status !== 'succeeded' || !job.entity) return null;
  const source = job.entity.document ?? {schemaVersion: 1, key: job.id, title: record.title,
    packaging: job.entity.packaging, surfaces: job.entity.surfaces, components: job.entity.components,
    calibration: job.entity.calibration} satisfies AlbumEntity;
  const capability = inspectAlbum(source, {rigVersion: 1});
  if (!capability.supported) return null;
  const entity = capability.entity;
  return {entity, resolveAsset: asset => Object.hasOwn(entity.assets, asset)
    ? '/api/twin-assets/' + job.id + '/' + asset : ''};
}
