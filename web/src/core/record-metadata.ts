// 元数据保存回显：只合并服务端确认的编辑字段，财务结果保持当前快照。
// 字段与 storage.RECORD_METADATA_FIELDS 对齐；独立于普通 /api/state 同步。
import type {AlbumRecord, AppState} from '../types';
import type {StateSnapshot} from './state-sync';

export const RECORD_METADATA_FIELDS = ['title', 'artist', 'cover', 'coverSource', 'version', 'packaging',
  'pressing', 'obi', 'note', 'noteAlbum', 'storage', 'releaseInfo'] as const;

export interface RecordMetadataSave {
  ids: string[];
  records: (Pick<AlbumRecord, 'id' | 'revision'> & Partial<AlbumRecord>)[];
  audit: AppState['audit'];
}

export function applyMetadataSave(base: StateSnapshot, saved: RecordMetadataSave): StateSnapshot {
  const changed = new Map(saved.records.map(row => [row.id, row]));
  const records = base.state.records.map(record => {
    const patch = changed.get(record.id);
    if (!patch || patch.revision < record.revision) return record;
    // Undefined clears optional metadata removed by canonical cleaning. Money,
    // status and sale/shipment links are intentionally outside this field list.
    const fields = Object.fromEntries([...RECORD_METADATA_FIELDS, 'photoCount', 'photoRevision']
      .map(key => [key, patch[key as keyof AlbumRecord]]));
    return {...record, ...fields, revision: patch.revision};
  });
  const audit = [...new Map([...base.state.audit, ...saved.audit].map(row => [row.id, row])).values()]
    .sort((a, b) => a.id - b.id).slice(-100);
  return {etag: '', state: {...base.state, records, audit}};
}
