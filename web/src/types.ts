import type {DiscCalibration} from '@diedu/album-engine/disc-calibration';
// API 数据模型：与 storage.py 的 state() 输出一一对应。
// 金额一律是字符串（服务端 Decimal 量化到分），显示时再转 Number。
import {formatPackagingName} from './core/album-packaging';
import {copyEditionLabel} from './core/copy-edition';
import {displayRegion} from './core/release-metadata';

export type Status = 'overseas' | 'transit' | 'domestic' | 'shipping' | 'sold' | 'trash';
export type SaleStatus = 'shipping' | 'complete' | 'cancelled' | 'returned' | 'refunded';
export type ShipmentStatus = 'transit' | 'arrived' | 'cancelled';
export type Currency = 'JPY' | 'CNY';
export type SortMode = 'new' | 'cost' | 'artist';

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
  listingChannel?: string;
  listingUrl?: string;
  sourceId?: string;
  releaseYear?: string;
  rawRemark?: string;
  storage?: string;         // 实物存放位置，与购买渠道 location 分开
  releaseInfo?: ReleaseInfo;
  listingDescription?: string;
  listingDraft?: import('./core/listing').ListingDraft;
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
  catalogNumber?: string; barcode?: string; musicBrainzReleaseId?: string; discogsReleaseId?: string; manualRelease?: string; unofficial?: string; label?: string; country?: string;
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
  identifierMatch: boolean; url: string; source?: 'discogs';
}

export interface SaleItem {
  recordId: string;
  gross: string;
  fees: string;
  postage: string;
  refund: string;
  net: string;
  profit: string | null;
  grossOriginal?: string;   // 日元售出：原币金额（人民币折算后留存，同运费口径）
  feesOriginal?: string;
  postageOriginal?: string;
}

export interface Sale {
  id: string;
  date: string;
  status: SaleStatus;
  receivedDate: string;
  refundDate?: string;
  gross: string;
  fees: string;
  postage: string;
  currency?: Currency;
  grossOriginal?: string;
  feesOriginal?: string;
  postageOriginal?: string;
  address: string;
  note: string;
  channel: string;
  orderId: string;
  createdAt: string;
  items: SaleItem[];
}

export interface ShipmentItem {
  recordId: string;
  fee: string;
  feeOriginal?: string;
}

export interface Shipment {
  id: string;
  method: string;
  cost: string;
  currency?: Currency;
  costOriginal?: string;
  date: string;
  note: string;
  status: ShipmentStatus;
  arrivedDate: string;
  createdAt: string;
  items: ShipmentItem[];
}

export interface AuditEntry {
  at: string;
  action: string;
}

export interface BackupStatus {
  last: string | null;
  count: number;
  error: string;
}

export interface AppState {
  format: 'album-ledger';
  schema: number;
  createdAt: string;
  records: AlbumRecord[];
  sales: Sale[];
  shipments: Shipment[];
  audit: AuditEntry[];
  settings: Record<string, unknown>;
  modules?: {enabled: ModuleFlags; configured: boolean; needsSetup: boolean; startPage?: StartPage}; // 旧运行进程尚未重启时可能缺失
  rateService?: { days: number; latest: string | null };
  service?: { login: boolean; version?: string; backup: BackupStatus };
}

export interface ModuleFlags {
  acquisition: boolean;
  trading: boolean;
  circulation: boolean;
  showcase: boolean;
}

export type StartPage = 'domestic' | 'gallery';

export interface BackupFile {
  format: 'album-ledger';
  createdAt: string;
  records: AlbumRecord[];
  sales: Sale[];
  shipments?: Shipment[];
}

export const STATUS_NAMES: Record<Status, string> = {
  overseas: '海外库存', transit: '海外在途', domestic: '国内库存',
  shipping: '售出中', sold: '已售出', trash: '回收站',
};

export const SALE_NAMES: Record<SaleStatus, string> = {
  shipping: '售出中', complete: '已售出', cancelled: '已撤销',
  returned: '已退货', refunded: '已退款',
};

// 实物版次和侧标独立于 MusicBrainz 发行资料；未填写不代表无侧标。
export function labelTags(r: AlbumRecord): string[] {
  const p = copyEditionLabel(displayRegion(r.releaseInfo?.country, r.pressing), r.obi);
  return [p, formatPackagingName(r.version, r.packaging)].filter(Boolean);
}

/** 列表行的元信息拆成「地区」+「其他」两层：地区（美国 / 日本…）突出，侧标与包装次之；包装未核对写成「包装待核对」。 */
export function metaTokens(r: AlbumRecord): {region: string; details: string[]} {
  const pkg = formatPackagingName(r.version, r.packaging);
  return {
    region: displayRegion(r.releaseInfo?.country, r.pressing),
    details: [r.obi?.trim(), pkg === '待核对' ? '包装待核对' : pkg].filter((x): x is string => !!x),
  };
}
