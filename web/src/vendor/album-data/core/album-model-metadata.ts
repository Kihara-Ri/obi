import type {ModelAssets} from '../schema';
import type {AlbumPackaging} from './album-packaging';

/** A disc count selects a carrier, never silently selects a fatbox shell. */
export function albumModelAsset(model: AlbumPackaging, calibrated = false, models: ModelAssets = {baseUrl: '', rigVersion: 1}): string {
  const kind = model.kind;
  const name = kind === 'gatefold' && model.panels === 2 && model.miniLP && model.holder === 'pocket'
    && model.pocketOpening === 'outer' && calibrated ? 'gatefold-2-mini-lp'
    : kind === 'jewel' ? model.thickness === 'slim' ? 'slimline-jewel'
    : model.thickness === 'thick' ? 'jewel-fat'
      : model.discs > 2 ? 'jewel-swing-4' : model.discs > 1 ? 'jewel-swing-2' : 'jewel-case'
    : kind === 'gatefold' || kind === 'digipak' ? kind + '-' + model.panels
      + (kind === 'gatefold' && model.holder === 'pocket' && model.pocketOpening === 'inner' ? '-inner' : '')
      : kind === 'card-sleeve' && model.miniLP ? 'mini-lp-sleeve'
        : kind === 'unknown' ? 'neutral' : kind;
  return (models.baseUrl ? models.baseUrl.replace(/\/?$/, '/') : '') + name + '.glb';
}

export function albumPanelDiscs(model: AlbumPackaging, panel: number): number[] {
  if (model.kind === 'jewel') return Array.from({length: model.discs}, (_, i) => i);
  if (model.kind === 'card-sleeve' || model.kind === 'rigid-box')
    return panel === 1 ? Array.from({length: model.discs}, (_, i) => i) : [];
  if (model.holder === 'pocket' && model.pockets !== 'both')
    return panel === (model.pockets === 'left' ? 0 : 1) ? Array.from({length: model.discs}, (_, i) => i) : [];
  if (model.discs === 1) return panel === 1 ? [0] : [];
  const count = Math.min(model.panels, model.discs);
  if (panel >= count) return [];
  const before = Array.from({length: panel}, (_, i) => Math.floor(model.discs / count) +
    (i >= count - model.discs % count ? 1 : 0)).reduce((a, b) => a + b, 0);
  const amount = Math.floor(model.discs / count) + (panel >= count - model.discs % count ? 1 : 0);
  return Array.from({length: amount}, (_, i) => before + i);
}
