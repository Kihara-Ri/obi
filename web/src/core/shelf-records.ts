import type {AlbumRecord, ModuleFlags, SortMode} from '../types';
import {searchScore} from './search';

export function shelfRecords(records: AlbumRecord[], {page, query, sort, flip, shelfFilter, modules}: {
  page: string; query: string; sort: SortMode; flip: boolean; shelfFilter: string; modules: ModuleFlags;
}): AlbumRecord[] {
  let results = modules.trading && page !== 'trash' && shelfFilter !== 'all'
    ? records.filter(record => !!record.listed === (shelfFilter === 'listed'))
    : [...records];
  const q = query.trim().toLocaleLowerCase();
  if (q) {
    results = results.map(record => ({record, score: searchScore(record, q)}))
      .filter(hit => hit.score > 0).sort((a, b) => b.score - a.score).map(hit => hit.record);
  }
  if (sort === 'listed') {
    return results.sort((a, b) => {
      if (a.listingOrder === undefined) return b.listingOrder === undefined ? 0 : 1;
      if (b.listingOrder === undefined) return -1;
      return flip ? a.listingOrder - b.listingOrder : b.listingOrder - a.listingOrder;
    });
  }
  if (q) return results;
  return results.sort((a, b) => sort === 'cost'
    ? ((b.cost === null ? -1 : Number(b.cost)) - (a.cost === null ? -1 : Number(a.cost)))
    : sort === 'artist' ? a.artist.localeCompare(b.artist)
      : modules.acquisition ? b.date.localeCompare(a.date) : b.createdAt.localeCompare(a.createdAt));
}
