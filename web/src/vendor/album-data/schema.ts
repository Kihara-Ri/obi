/** Portable printed-object description. No host record, task, route or photo-slot semantics. */
export type PackagingStructure = 'jewel' | 'card-sleeve' | 'gatefold' | 'digipak' | 'digibook' | 'rigid-box' | 'unknown';
export type PackagingPhotoRole = 'front' | 'back' | 'spine' | 'insideSpine' | 'insideLeft' | 'insideRight' | 'insideCenter' | 'insideExtra' | 'disc' | 'disc2' | 'disc3' | 'disc4' | 'outer';
export type PackagingPhotoRegion = [number, number, number, number, number, number, number, number];
export type PackagingWarpRow = [number, number, number, number];
import type {DiscCalibration} from './core/album-disc-calibration';
export type {DiscCalibration, DiscEllipse} from './core/album-disc-calibration';
export interface PackagingSpec {
  structure?: PackagingStructure;
  thickness?: 'slim' | 'standard' | 'thick';
  panels?: 2 | 3 | 4;
  pockets?: 'left' | 'right' | 'both';
  pocketOpening?: 'outer' | 'inner';
  holder?: 'tray' | 'pocket';
  tray?: 'clear' | 'black' | 'white';
  discs?: 1 | 2 | 3 | 4;
  finish?: 'uncoated' | 'matte' | 'gloss';
  miniLP?: boolean;
  slipcase?: boolean;
  size?: {width: number; height: number; depth: number};
}
export type AlbumPresentation = import('./contracts/document-types').SchemaPresentation;
export type AlbumCalibration = {spine: import('./contracts/document-types').SchemaSpine};
export interface AlbumSurface {
  asset: string;
  region?: PackagingPhotoRegion | null;
  warpRows?: PackagingWarpRow[];
  discCalibration?: DiscCalibration;
  sourceUrl?: string;
  origin?: string;
  sourceReleaseId?: string;
}
/** A separately manipulable physical print, not an alias for a case surface. */
export type PaperFold = import('./contracts/document-types').SchemaPaperFold;
export interface AlbumAccessory {
  id: string;
  kind: 'obi' | 'booklet' | 'inner-sleeve';
  asset: string;
  /** Explicit accordion construction; ordinary booklets retain their existing model. */
  fold?: PaperFold;
  /** Optional crop of the component's *own* photograph; never a case surface. */
  region?: PackagingPhotoRegion | null;
  origin?: string;
  sourceUrl?: string;
  sourceReleaseId?: string;
  /** Independent verso artwork; absent means unprinted or unverified. */
  back?: AlbumSurface;
}
export interface AlbumEntity {
  schemaVersion: 1;
  key: string;
  title: string;
  packaging: PackagingSpec;
  surfaces: Partial<Record<PackagingPhotoRole, AlbumSurface>>;
  components?: AlbumAccessory[];
  calibration?: AlbumCalibration;
  placeholderHue?: 0 | 1 | 2 | 3;
}
/** Physical wire types are generated from the shared JSON schema. */
export type {SchemaDimensions as ComponentDimensions,
  SchemaPackage as PackageComponent, SchemaInsert as InsertComponent,
  SchemaDocument as AlbumDocument} from './contracts/document-types';
import type {SchemaPackage, SchemaInsert, SchemaDocument} from './contracts/document-types';
export type AlbumComponent = SchemaPackage | SchemaInsert;
type AlbumDocument = SchemaDocument;
export type AlbumSource = AlbumEntity | AlbumDocument;
export type AssetResolver = (asset: string) => string;
export interface ModelAssets {baseUrl: string; rigVersion: 1}
export const ENTITY_SCHEMA_VERSION = 2;
export const LEGACY_ENTITY_SCHEMA_VERSION = 1;
export const MODEL_RIG_VERSION = 1;
