import type {AlbumEngineRuntime} from './album-engine-plugin';
import type {AlbumRecord} from '../types';
import {toAlbumEntity} from './album-entity';

/** Editor warnings and the renderer calculate the same geometry in the engine. */
export function spineCalibrationFit(record: AlbumRecord, runtime: AlbumEngineRuntime | null) {
  const entity = toAlbumEntity(record);
  return runtime?.spineCalibrationFit({packaging: entity.packaging, modelCalibration: entity.calibration});
}
