// 专辑、副本、发行资料及实体插件的 API 数据模型。
import type {DiscCalibration} from '@diedu/album-engine/disc-calibration';
import type {Currency, RateQuote, Status} from '../types';
import type {AlbumDocument, PackagingSpec as EntityPackagingSpec, PackagingPhotoRole,
  PackagingPhotoRegion, PackagingWarpRow, AlbumCalibration} from '@diedu/album-engine/schema';
export type {PackagingStructure, PackagingPhotoRole, PackagingPhotoRegion, PackagingWarpRow} from '@diedu/album-engine/schema';
export type TwinCalibration = AlbumCalibration;
export interface TwinAccessory {id: string; kind: 'obi' | 'booklet' | 'inner-sleeve'; asset: string; origin: string; sourceUrl: string; sourceReleaseId?: string}
export interface TwinEntity {
  document?: AlbumDocument;
  packaging: PackagingSpec;
  components?: TwinAccessory[];
  surfaces: Partial<Record<PackagingPhotoRole, {asset: string; region?: PackagingPhotoRegion | null; warpRows?: PackagingWarpRow[]; discCalibration?: DiscCalibration; sourceUrl: string; origin: string}>>;
  release?: {id: string; title: string; url: string};
  calibration?: TwinCalibration;
  skill: string;
  warnings: string[];
}
export interface TwinJob {
  id: string; recordId: string;
  status: 'queued' | 'running' | 'needs_input' | 'succeeded' | 'failed' | 'interrupted' | 'cancelled' | 'stale';
  phase: string; message: string; error: string; seq: number;
  createdAt: string; updatedAt: string;
  instructions?: string; releaseId?: string;
  barcode?: string; barcodeSource?: 'manual' | 'photo' | 'record' | '';
  generationMode?: 'ai' | 'guided';
  candidates?: TwinReleaseCandidate[]; entity?: TwinEntity | null;
  models?: {version: string; modelSet: string; files: Record<string, {sha256: string; url: string}>};
}
export interface TwinIndex {
  epoch: string; revision: number; jobs: Record<string, TwinJob>;
  configured: boolean; skill: string;
}
/** Exact-barcode release review; separate from name-based recognition suggestions. */
export interface TwinReleaseCandidate {
  id: string; title: string; artist: string; date: string; country: string;
  barcode: string; catalogNumber: string; label: string; discCount: number;
  edition?: string; packaging?: string | null;
  editionReferences?: {origin: 'discogs'; status: 'verified' | 'missing' | 'unavailable' | 'mismatched' | 'ambiguous';
    id?: string; url?: string; title?: string; barcode?: string; catalogNumbers?: string[]; notes?: string;
    images?: {sourceId: string; url: string; type: string; width?: number; height?: number}[]}[];
  compatibleArtwork?: {releaseId: string; images: {sourceId: string; types: string[]}[]}[];
  media: {position: number; format: string; tracks: {position: number; title: string; length?: number}[]}[];
  url: string;
  artwork: {id: string; types: string[]; comment: string; previewUrl?: string;
    previewStatus?: 'available' | 'unavailable' | 'not_loaded'}[];
  artworkStatus: 'available' | 'missing' | 'unavailable';
}
export interface PackagingSpec extends EntityPackagingSpec {
  photos?: Partial<Record<PackagingPhotoRole, number>>;
  photoRegions?: Partial<Record<PackagingPhotoRole, PackagingPhotoRegion>>;
}

export interface CoverSource {
  title: string;
  artist: string;
  year?: string;
  provider?: string;
  page?: string;
  url?: string;
  country?: string;
}

/** Persistent musical Album, independent of any owned physical CD copies. */
export interface AlbumEntity {
  id: string;
  title: string;
  artist: string;
  musicBrainzReleaseGroupId: string | null;
  liked: boolean;
  createdAt: string;
}
export interface AlbumCatalog {
  albums: Record<string, AlbumEntity>;
  recordAlbumIds: Record<string, string>;
  favorites: Record<string, boolean>;
  collectedAt: Record<string, string>;
}

export interface AlbumRecord {
  rateQuote?: RateQuote;
  /** Viewer-only task assets, never submitted as ledger data. */
  modelSources?: Partial<Record<PackagingPhotoRole, {sourceUrl: string; origin: string}>>;
  modelTextures?: Partial<Record<PackagingPhotoRole, string>>;
  modelWarpRows?: Partial<Record<PackagingPhotoRole, PackagingWarpRow[]>>;
  modelDiscCalibrations?: Partial<Record<PackagingPhotoRole, DiscCalibration>>;
  modelAccessories?: (TwinAccessory & {source: string})[];
  modelCalibration?: TwinCalibration;
  id: string;
  title: string;
  artist: string;
  status: Status;
  date: string;
  currency: Currency;
  price: string;            // '' 表示待补
  rate?: string;            // 100日元兑人民币（state() 时由后端补）
  fees: string;
  actual: string;
  cost: string | null;      // null = 成本待补
  cover: string;            // 封面引用（/api/cover/<内容哈希>.<ext>）或 ''
  coverSource?: CoverSource;
  location: string;
  version: string;
  legacyPackaging?: string; // 历史包装归档
  packaging?: PackagingSpec;
  pressing: string;
  obi: string;
  note: string;
  noteAlbum: string;
  photoCount: number;
  photoRevision?: number;
  revision: number;
  createdAt: string;
  shipmentId?: string;
  saleId?: string;
  previousStatus?: Status;
  listed?: boolean;         // 持有副本的上架标记，与位置和交易状态分开
  listingOrder?: number;    // /api/state 中按有据可查的上架时间从早到晚编号
  xianyuItemId?: string;     // 从保存的闲鱼商品链接提取
  listingChannel?: string;
  listingUrl?: string;
  sourceId?: string;
  releaseYear?: string;
  rawRemark?: string;
  storage?: string;         // 实物存放位置，与购买渠道 location 分开
  releaseInfo?: ReleaseInfo;
  listingDescription?: string;
  listingDraft?: {title: string; description: string};
}

export interface ReleaseTrack {
  position: number;
  title: string;
  lengthMs?: number;
}

export interface ReleaseMedium {
  position: number;
  format: string;
  title: string;
  tracks: ReleaseTrack[];
}

export interface ReleaseInfo {
  catalogNumber?: string; barcode?: string; musicBrainzReleaseId?: string; discogsReleaseId?: string;
  deezerId?: string; itunesId?: string; ndlBibId?: string;
  manualRelease?: string; unofficial?: string; label?: string; country?: string;
  releaseDate?: string; edition?: string; packaging?: string; format?: string; discCount?: string;
  matrix?: string; extras?: string; observations?: string; tracklist?: string[]; media?: ReleaseMedium[];
}

/** 上架描述用到的专辑字段（原 RecognitionFields）。 */
export interface ListingFields {
  title?: string; artist?: string; price?: string; version?: string; pressing?: string;
  obi?: string; note?: string; releaseInfo?: ReleaseInfo; listingDescription?: string;
  cover?: string; coverSource?: CoverSource;
}

export interface ReleaseCandidate {
  id: string; title: string; artist: string; releaseInfo: ReleaseInfo;
  identifierMatch: boolean; url: string;
  source?: 'musicbrainz' | 'discogs' | 'deezer' | 'itunes' | 'ndl';
  /** Deezer / iTunes 候选自带封面（MusicBrainz 走 Cover Art Archive）；实体版也可能借来同码数字发行的封面 */
  cover?: string; coverSmall?: string;
  /** 并发检索合并时，同一版本（同条码 / 编号）在其他来源的条目 */
  alsoIn?: {id: string; source: string; url: string}[];
}
