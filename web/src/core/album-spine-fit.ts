import type {AlbumRecord} from '../types';
import {albumPackaging} from './album-packaging';
import {albumPanelDiscs} from './album-model-assets';

export interface SpineCalibrationFit {
  basis: 'image-estimate'; status: 'applied' | 'minimum-cd-fit';
  requestedMm: number; appliedMm: number; minimumMm: number; factor: number; compactPockets: boolean;
}

/** The form and renderer use the same nominal geometry and CD clearance rule. */
export function spineCalibrationFit(record: Pick<AlbumRecord, 'version' | 'packaging' | 'modelCalibration'>): SpineCalibrationFit | null {
  const calibration = record.modelCalibration?.spine, model = albumPackaging(record.version, record.packaging);
  if (!calibration || !['gatefold', 'digipak', 'digibook'].includes(model.kind)) return null;
  const inward = model.kind === 'gatefold' && model.holder === 'pocket' && model.pocketOpening === 'inner';
  const nominalWidth = inward ? 138 : model.kind === 'digipak' ? 139 : model.kind === 'digibook' ? 140 : 135;
  const compactPockets = model.kind === 'gatefold' && model.holder === 'pocket' && model.miniLP && !inward
    && Array.from({length: model.panels}, (_, i) => albumPanelDiscs(model, i).length).every(count => count <= 1);
  const minimumGap = Array.from({length: model.panels}, (_, panel) => {
    const count = albumPanelDiscs(model, panel).length;
    return !count ? 0 : model.holder === 'pocket'
      ? (inward ? 2.07 : compactPockets ? 2.5 : 3.8) + (count - 1) * 1.25 : 4.8 + (count - 1) * 1.8;
  }).reduce((a, b) => a + b, inward ? .12 : .7);
  const nominalGap = (inward ? 4.6 : model.kind === 'digibook' ? 13 : model.kind === 'digipak' ? 7 : 4) * (model.panels - 1);
  const flat = inward || model.kind === 'gatefold' && model.panels === 2 && model.miniLP && model.holder === 'pocket' && model.pocketOpening === 'outer';
  const arc = flat ? 1 : Math.PI / 2;
  const requested = calibration.widthRatio * (record.packaging?.size?.width ?? nominalWidth), minimum = Math.max(minimumGap, model.kind === 'digibook' ? 13 : 0) * arc;
  const applied = Math.max(requested, minimum);
  return {basis: calibration.basis, status: requested < minimum ? 'minimum-cd-fit' : 'applied',
    requestedMm: requested, appliedMm: applied, minimumMm: minimum,
    factor: applied / (nominalGap * arc), compactPockets};
}

