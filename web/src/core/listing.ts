// 副本售卖草稿：照片更新时保留手写文案，清除旧证据与确认；不推断版次或价格。
import type {AlbumRecord} from '../types';
import type {StyleOptions} from './listing-style';

export interface ListingFact {text: string; photos: number[]; kind?: string}
export interface ListingCandidate {id: string; title: string; artist: string; country: string; date: string; catalogNumber: string; barcode: string}
export interface ListingAnalysis {
  versionText: string; conditionText: string; saleTerms: string; conflicts: string[];
  identifiers: ListingFact[]; observations: ListingFact[]; pending: string[];
  candidates: ListingCandidate[]; catalogError: string; photoRevision: number;
}
export interface ListingDraft {
  title: string; description: string; photoOrder: number[]; photoRevision: number;
  versionText: string; conditionText: string; versionConfirmed: boolean; conditionConfirmed: boolean;
  selectedRelease?: string; analysis?: ListingAnalysis;
  generation?: {presetId: string; presetName: string; instructions: string; supplement: string;
    contextHash: string; sourceContext: string; provider: string; model: string};
}
export type ListingProviderId = 'openai' | 'deepseek' | 'anthropic' | 'opencode' | 'api';
export interface ListingModelOption {
  value: string; label: string; efforts: string[]; vision: boolean | null; resolvedModel: string;
}
export interface ListingProvider {
  provider: ListingProviderId; effort: string; models: ListingModelOption[]; ready: boolean; textReady: boolean;
  providers: {id: ListingProviderId; connected: boolean; inUse: boolean; tested?: boolean}[];
  inUse: boolean; keyTail: string; keySource: 'saved' | 'server'; lane: 'go' | 'zen';
  tested: {ok: boolean; at: number; error: string} | null;
  claudeInstalled: boolean; loginUrl: string;
  connected: boolean; method: 'oauth' | 'api'; model: string; active: string;
  accounts: {id: string; label: string}[]; hostId: string; apiConfigured: boolean;
  apiModel: string; loginPending: boolean; loginError: string; localLoginAvailable: boolean;
}

export interface ListingPreset {id: string; name: string; instructions: string; options?: Partial<StyleOptions>}
export interface ListingPreferences {
  revision: number; defaultPreset: string; customPresets: ListingPreset[]; builtins: ListingPreset[];
}
export interface ListingJob {
  id: string; status: 'running' | 'succeeded' | 'failed';
  phase?: 'preparing' | 'analyzing' | 'writing' | 'saving' | 'done';
  error?: string; analysis?: ListingAnalysis; draft?: ListingDraft; autoSaved?: boolean; savedRevision?: number;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function listingContextChanged(record: AlbumRecord): boolean {
  const source = record.listingDraft?.generation?.sourceContext;
  if (!source) return false;
  const release = record.releaseInfo ?? {};
  const keys = ['catalogNumber', 'barcode', 'label', 'country', 'releaseDate', 'edition', 'packaging', 'format',
    'discCount', 'matrix', 'extras', 'observations', 'musicBrainzReleaseId', 'discogsReleaseId', 'manualRelease', 'unofficial', 'tracklist', 'media'];
  const packaging = Object.fromEntries(Object.entries(record.packaging ?? {}).filter(([key]) =>
    ['structure', 'thickness', 'panels', 'tray', 'finish', 'discs', 'miniLP', 'slipcase'].includes(key)));
  const context = {album: {title: record.title, artist: record.artist, releaseYear: record.releaseYear ?? ''},
    release: Object.fromEntries(Object.entries(release).filter(([key, value]) => keys.includes(key) && !!value && (!Array.isArray(value) || value.length > 0))),
    copy: {...Object.fromEntries(['version', 'pressing', 'obi', 'condition'].flatMap(key => {
      const value = (record as unknown as Record<string, unknown>)[key]; return value ? [[key, value]] : [];
    })), ...(Object.keys(packaging).length ? {packaging} : {})}};
  try {return canonical(JSON.parse(source)) !== canonical(context);} catch {return true;}
}

export function draftFor(record: AlbumRecord): ListingDraft {
  const saved = record.listingDraft;
  const stale = saved?.photoRevision !== (record.photoRevision ?? 0) || listingContextChanged(record);
  return {title: `${record.artist} ${record.title} CD`, description: record.listingDescription ?? '',
    versionText: '', conditionText: '', versionConfirmed: false, conditionConfirmed: false,
    ...saved, ...(stale ? {analysis: undefined, selectedRelease: '', versionConfirmed: false, conditionConfirmed: false} : {}),
    photoRevision: record.photoRevision ?? 0,
    photoOrder: saved && !stale ? saved.photoOrder : Array.from({length: record.photoCount}, (_, i) => i)};
}

export function candidateText(candidate: ListingCandidate): string {
  return [candidate.artist, candidate.title, candidate.country, candidate.date,
    candidate.catalogNumber, candidate.barcode].filter(Boolean).join(' · ');
}
