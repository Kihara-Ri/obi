import {spineCalibrationFit as engineFit} from '@diedu/album-engine/calibration';
import type {AlbumRecord} from '../types';
import {toAlbumEntity} from './album-entity';

/** Editor warnings and the renderer calculate the same geometry in the engine. */
export function spineCalibrationFit(record: AlbumRecord) {
  const entity = toAlbumEntity(record);
  return engineFit({packaging: entity.packaging, modelCalibration: entity.calibration});
}
