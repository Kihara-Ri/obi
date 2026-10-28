// 副本售卖草稿：照片更新时保留手写文案，清除旧证据与确认；不推断版次或价格。
import type {AlbumRecord} from '../types';

export interface ListingFact {text: string; photos: number[]; kind?: string}
export interface ListingCandidate {id: string; title: string; artist: string; country: string; date: string; catalogNumber: string; barcode: string}
export interface ListingAnalysis {
  identifiers: ListingFact[]; observations: ListingFact[]; pending: string[];
  candidates: ListingCandidate[]; catalogError: string; photoRevision: number;
}
export interface ListingDraft {
  title: string; description: string; photoOrder: number[]; photoRevision: number;
  versionText: string; conditionText: string; versionConfirmed: boolean; conditionConfirmed: boolean;
  selectedRelease?: string; analysis?: ListingAnalysis;
}
export type ListingProviderId = 'openai' | 'deepseek' | 'anthropic' | 'opencode' | 'api';
export interface ListingModelOption {
  value: string; label: string; efforts: string[]; vision: boolean | null; resolvedModel: string;
}
export interface ListingProvider {
  provider: ListingProviderId; effort: string; models: ListingModelOption[]; ready: boolean;
  providers: {id: ListingProviderId; connected: boolean; inUse: boolean; tested?: boolean}[];
  inUse: boolean; keyTail: string; keySource: 'saved' | 'server'; lane: 'go' | 'zen';
  tested: {ok: boolean; at: number; error: string} | null;
  claudeInstalled: boolean; loginUrl: string;
  connected: boolean; method: 'oauth' | 'api'; model: string; active: string;
  accounts: {id: string; label: string}[]; hostId: string; apiConfigured: boolean;
  apiModel: string; loginPending: boolean; loginError: string; localLoginAvailable: boolean;
}

export function draftFor(record: AlbumRecord): ListingDraft {
  const saved = record.listingDraft;
  const stale = saved?.photoRevision !== (record.photoRevision ?? 0);
  return {title: `${record.artist} ${record.title} CD`, description: record.listingDescription ?? '',
    versionText: '', conditionText: '', versionConfirmed: false, conditionConfirmed: false,
    ...saved, ...(stale ? {analysis: undefined, selectedRelease: '', versionConfirmed: false, conditionConfirmed: false} : {}),
    photoRevision: record.photoRevision ?? 0,
    photoOrder: saved && !stale ? saved.photoOrder : Array.from({length: record.photoCount}, (_, i) => i)};
}

export function saleDescription(draft: ListingDraft): string {
  if (!draft.versionConfirmed || !draft.conditionConfirmed) throw new Error('请先核对版本和品相');
  return [draft.versionText.trim() && `版本：${draft.versionText.trim()}`,
    draft.conditionText.trim() && `品相：${draft.conditionText.trim()}`,
    '实物及附件以本帖照片和上述说明为准。'].filter(Boolean).join('\n');
}

export function candidateText(candidate: ListingCandidate): string {
  return [candidate.artist, candidate.title, candidate.country, candidate.date,
    candidate.catalogNumber, candidate.barcode].filter(Boolean).join(' · ');
}
