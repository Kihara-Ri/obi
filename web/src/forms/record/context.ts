// 专辑表单共享：表单值类型、初始值与各 hook 共用的上下文（值、改值、原记录快照、脏标记）。
import type {Dispatch, MutableRefObject, RefObject, SetStateAction} from 'react';
import {displayReleaseTitle, releaseRegion} from '../../core/release-metadata';
import {identityFromCandidate} from '../../core/release-source';
import {recordMedium} from '../../core/medium';
import {vinylPackagingFromCatalog, type VinylSpec} from '../../core/vinyl';
import type {AlbumRecord, Currency, PackagingSpec, ReleaseCandidate, ReleaseInfo, Status} from '../../types';

export interface RecordValues {
  title: string; artist: string; price: string; date: string; currency: Currency; location: string;
  fees: string; version: string; packaging: PackagingSpec | null; pressing: string; obi: string;
  note: string; noteAlbum: string; storage: string; status: Status | undefined;
  releaseInfo: ReleaseInfo;
  vinyl: VinylSpec | null;
}

export interface FormCtx {
  v: RecordValues;
  set: (patch: Partial<RecordValues>) => void;
  setV: Dispatch<SetStateAction<RecordValues>>;
  live: MutableRefObject<RecordValues>;
  base: MutableRefObject<Partial<AlbumRecord>>;
  dirty: () => void;
  formRef: RefObject<HTMLFormElement | null>;
}

export function initialValues(base: Partial<AlbumRecord>, where: Status | null): RecordValues {
  return {
    title: displayReleaseTitle(base.title || ''),
    artist: base.artist || '',
    price: base.currency === 'JPY' && base.price !== ''
      ? String(Math.round(Number(base.price))) : (base.price || ''),
    date: base.date ?? '',
    currency: (base.currency || 'JPY') as Currency,
    location: base.location || '',
    fees: base.fees || '0',
    version: base.version || '',
    packaging: base.packaging ?? null,
    pressing: base.pressing || '',
    obi: base.obi || '',
    note: base.note || '',
    noteAlbum: base.noteAlbum || '',
    storage: base.storage || '',
    status: (where ?? base.status) as Status | undefined,
    releaseInfo: base.releaseInfo ?? {},
    vinyl: base.vinyl ?? null,
  };
}

/** 「查询」页带入的已核对发行版 → 新增表单的初始字段（身份取自候选，不按标题猜）。 */
export function seedFields(c: ReleaseCandidate): Partial<AlbumRecord> {
  const releaseInfo = {...c.releaseInfo, ...identityFromCandidate(c)};
  return {title: displayReleaseTitle(c.title), artist: c.artist, version: initialPackaging(releaseInfo),
    pressing: releaseRegion(releaseInfo.country), releaseInfo};
}

/** 选定发行版时带入的包装：黑胶把资料库的包装名换成黑胶预设，认不出留空让用户选（D-055） */
export function initialPackaging(info: ReleaseInfo): string {
  const text = info.packaging || '';
  return recordMedium(info) === 'vinyl' ? vinylPackagingFromCatalog(text) : text;
}
