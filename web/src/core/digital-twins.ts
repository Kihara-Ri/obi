import type {AlbumRecord, PackagingPhotoRole, PackagingWarpRow, TwinIndex, TwinJob} from '../types';
import type {DiscCalibration} from '@diedu/album-engine/disc-calibration';

export function twinBusy(job?: TwinJob): boolean {return job?.status === 'queued' || job?.status === 'running';}

/** Formatting changes do not change a barcode; different or incomplete digits require a fresh review. */
export function twinBarcodeMatches(draft: string, reviewed: string): boolean {
  const normalize = (value: string) => value.normalize('NFKC').replace(/[\s-]/g, '');
  return !!normalize(reviewed) && normalize(draft) === normalize(reviewed);
}

/** An older polling/POST response cannot rewind an already observed task. */
export function mergeTwinIndex(current: TwinIndex, next: TwinIndex): TwinIndex {
  if (current.epoch === next.epoch && next.revision < current.revision) return current;
  if (current.epoch !== next.epoch) return next;
  const jobs = {...next.jobs};
  for (const [id, job] of Object.entries(jobs)) {
    const old = current.jobs[id];
    if (old && old.id === job.id && old.seq === job.seq && old.status === job.status && old.error === job.error
      && JSON.stringify(old.models) === JSON.stringify(job.models)) jobs[id] = old;
  }
  return {...next, jobs};
}

export function twinViewerRecord(record: AlbumRecord, job?: TwinJob): AlbumRecord | null {
  if (job?.status !== 'succeeded' || !job.entity) return null;
  const packaging = {...job.entity.packaging, photoRegions: {...job.entity.packaging.photoRegions}};
  const textures: Partial<Record<PackagingPhotoRole, string>> = {};
  const warpRows: Partial<Record<PackagingPhotoRole, PackagingWarpRow[]>> = {};
  const discCalibrations: Partial<Record<PackagingPhotoRole, DiscCalibration>> = {};
  for (const [key, surface] of Object.entries(job.entity.surfaces)) {
    if (!surface) continue;
    const role = key as PackagingPhotoRole;
    textures[role] = '/api/twin-assets/' + job.id + '/' + surface.asset;
    if (surface.warpRows) warpRows[role] = surface.warpRows.map(row => [...row]);
    if (surface.discCalibration) discCalibrations[role] = structuredClone(surface.discCalibration);
    if (surface.region) packaging.photoRegions[role] = surface.region;
  }
  return {...record, packaging, modelTextures: textures,
    ...(job.entity.components?.length ? {modelAccessories: job.entity.components.map(item => ({...item,
      source: '/api/twin-assets/' + job.id + '/' + item.asset}))} : {}),
    modelSources: Object.fromEntries(Object.entries(job.entity.surfaces).filter(([, value]) => !!value)
      .map(([role, value]) => [role, {sourceUrl: value!.sourceUrl, origin: value!.origin}])),
    ...(Object.keys(warpRows).length ? {modelWarpRows: warpRows} : {}),
    ...(Object.keys(discCalibrations).length ? {modelDiscCalibrations: discCalibrations} : {}),
    ...(job.entity.calibration ? {modelCalibration: {spine: {...job.entity.calibration.spine,
      ...(job.entity.calibration.spine.reliefMm ? {reliefMm: [...job.entity.calibration.spine.reliefMm]} : {})}}} : {})};
}
