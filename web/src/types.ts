// API 数据模型：与 storage.py 的 state() 输出一一对应。
// 金额一律是字符串（服务端 Decimal 量化到分），显示时再转 Number。
import {formatPackagingName, packagingDisplay} from './core/album-packaging';
import {copyEditionLabel} from './core/copy-edition';
import {recordMedium} from './core/medium';
import {vinylTag} from './core/vinyl';
import {displayRegion} from './core/release-metadata';
import type {AlbumRecord} from './core/album-types';
export type * from './core/album-types';

export type Status = 'overseas' | 'transit' | 'domestic' | 'shipping' | 'sold' | 'trash';
export type SaleStatus = 'shipping' | 'complete' | 'cancelled' | 'returned' | 'refunded';
export type ShipmentStatus = 'transit' | 'arrived' | 'cancelled';
export type Currency = 'JPY' | 'CNY';
export type SortMode = 'new' | 'cost' | 'artist' | 'listed';

export interface RateQuote {
  requestedDate: string;
  quoteDate: string | null;
  rate: string | null;
  source: string;
  status: 'exact' | 'previous' | 'pending' | 'future' | 'invalid' | 'unavailable';
  checkedAt: number | null;
  provisional: boolean;
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
  /** 退货时自己承担的寄回运费（人民币，按件均分） */
  returnPostage?: string;
}

export interface Sale {
  rateQuote?: RateQuote;
  id: string;
  date: string;
  status: SaleStatus;
  receivedDate: string;
  refundDate?: string;
  /** 还没发货就退款：专辑回到售出前的库存，平台扣费与运费已清零 */
  unshipped?: boolean;
  /** 已退货：自己承担的寄回运费（人民币），与寄出运费分开记，计入损失 */
  returnPostage?: string;
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
  rateQuote?: RateQuote;
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
  id: number;
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
  records: AlbumRecord[];
  sales: Sale[];
  shipments: Shipment[];
  audit: AuditEntry[];
  settings: Record<string, unknown>;
  modules?: {enabled: ModuleFlags; configured: boolean; needsSetup: boolean; startPage?: StartPage}; // 旧运行进程尚未重启时可能缺失
  rateService?: { days: number; latest: string | null; neededDates?: string[]; retryAt?: number | null; error?: string };
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

export const SALE_NAMES: Record<SaleStatus, string> = {
  shipping: '售出中', complete: '已售出', cancelled: '已撤销',
  returned: '已退货', refunded: '已退款',
};

// 实物版次和侧标独立于 MusicBrainz 发行资料；未填写不代表无侧标。
export function labelTags(r: Pick<AlbumRecord, 'releaseInfo' | 'pressing' | 'obi' | 'version' | 'packaging' | 'vinyl'>): string[] {
  const p = copyEditionLabel(displayRegion(r.releaseInfo?.country, r.pressing), r.obi);
  return [p, mediumTag(r), packagingText(formatPackagingName(r.version, r.packaging))].filter(Boolean);
}

/** 黑胶副本的介质标签（12″ 黑胶）；CD 是常态不标（D-055） */
function mediumTag(r: Pick<AlbumRecord, 'releaseInfo' | 'vinyl'>): string {
  return recordMedium(r.releaseInfo) === 'vinyl' ? vinylTag(r.vinyl, r.releaseInfo) : '';
}

/** 摘要里的包装用中文名（「待核对」写成「包装待核对」）。 */
function packagingText(pkg: string): string {
  return !pkg ? '' : pkg === '待核对' ? '包装待核对' : packagingDisplay(pkg).name;
}

/** 列表行的元信息拆成「地区」+「其他」两层：地区（美国 / 日本…）突出，侧标与包装次之；包装未核对写成「包装待核对」。 */
export function metaTokens(r: AlbumRecord): {region: string; details: string[]; packaging: {kind: string; name: string} | null} {
  const pkg = formatPackagingName(r.version, r.packaging);
  const name = packagingText(pkg);
  return {
    region: displayRegion(r.releaseInfo?.country, r.pressing),
    details: [mediumTag(r), r.obi?.trim(), name].filter((x): x is string => !!x),
    packaging: name && pkg !== '待核对' ? {kind: packagingDisplay(pkg).kind, name} : null,
  };
}
