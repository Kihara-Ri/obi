import type {PackagingSpec, PackagingStructure} from '../schema';

export interface AlbumPackaging {
  kind: PackagingStructure | 'unknown';
  label: string;
  thickness: 'slim' | 'standard' | 'thick';
  aspect: number;
  depth: number;
  gloss: number;
  finish: 'uncoated' | 'matte' | 'gloss';
  panels: 2 | 3 | 4;
  pockets: 'left' | 'right' | 'both';
  pocketOpening: 'outer' | 'inner';
  holder: 'tray' | 'pocket';
  tray: 'clear' | 'black' | 'white';
  discs: 1 | 2 | 3 | 4;
  miniLP: boolean;
  slipcase: boolean;
  canOpen: boolean;
}

export function packagingName(kind: AlbumPackaging['kind'], spec: PackagingSpec = {}): string {
  let name = kind === 'jewel' ? spec.thickness === 'slim' ? 'Slimline Jewel Case'
    : spec.thickness === 'thick' ? 'Multi-CD Jewel Case' : 'Jewel Case'
    : kind === 'card-sleeve' ? 'Card Sleeve'
      : kind === 'gatefold' ? (spec.panels ?? 2) === 2 ? 'Gatefold Sleeve' : 'Digisleeve'
        : kind === 'digipak' ? 'Digipak' : kind === 'digibook' ? 'Digibook'
          : kind === 'rigid-box' ? 'Rigid Box' : '';
  if ((kind === 'gatefold' || kind === 'digipak') && (spec.panels ?? 2) > 2)
    name = (spec.panels ?? 2) * 2 + '-panel ' + name;
  if (spec.miniLP && kind === 'card-sleeve') name = 'Mini LP Sleeve';
  else if (spec.miniLP && name) name += ' · Mini LP';
  if (spec.slipcase && name) name += ' + Slipcase';
  return name;
}

/** A copy's explicit structure wins; legacy names supply conservative defaults only. */
export function albumPackaging(spec: PackagingSpec = {}): AlbumPackaging {
  const data = spec;
  const kind = data.structure ?? 'unknown';
  const ratio = kind === 'jewel' ? 142.4 / 124.5 : kind === 'digipak' ? 1.1 : 1;
  const baseDepth = kind === 'jewel' ? data.thickness === 'thick' ? .16 : data.thickness === 'slim' ? .037 : .073
    : kind === 'rigid-box' ? .16 : kind === 'digibook' ? .09
      : kind === 'digipak' ? .045 : kind === 'gatefold' ? .026 : data.miniLP ? .02 : .012;
  const depth = kind !== 'jewel' && kind !== 'rigid-box' ? baseDepth * (data.thickness === 'slim' ? .7 : data.thickness === 'thick' ? 1.6 : 1) : baseDepth;
  const finish = data.finish ?? (kind === 'jewel' ? 'gloss' : 'matte');
  return {
    kind, label: packagingName(kind, data), thickness: data.thickness ?? 'standard', aspect: data.size ? data.size.width / data.size.height : ratio,
    depth: data.size ? data.size.depth / data.size.width : depth,
    gloss: finish === 'gloss' ? .85 : finish === 'matte' ? .2 : .08, finish,
    panels: data.panels ?? 2, pockets: data.pockets ?? 'right', pocketOpening: data.pocketOpening ?? 'outer',
    holder: data.holder ?? (kind === 'jewel' || kind === 'digipak' ? 'tray' : 'pocket'),
    tray: data.tray ?? (kind === 'jewel' ? 'black' : 'clear'), discs: data.discs ?? 1,
    miniLP: data.miniLP ?? false, slipcase: data.slipcase ?? false,
    canOpen: kind !== 'unknown' && kind !== 'card-sleeve' || !!data.slipcase,
  };
}


export {albumModelAsset, albumPanelDiscs} from './album-model-metadata';
