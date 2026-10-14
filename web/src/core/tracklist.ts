import type {ReleaseInfo, ReleaseMedium, ReleaseTrack} from '../types';

export type TrackDisc = ReleaseMedium;

/** Prefer exact MusicBrainz media hierarchy; existing flat saved tracklists still work. */
export function trackDiscs(info: ReleaseInfo): TrackDisc[] {
  const structured = (info.media || []).filter(m => m.tracks?.length);
  if (structured.length) return structured.map(m => ({
    position: m.position, format: m.format || 'CD', title: m.title || '',
    tracks: m.tracks.filter(t => t.title?.trim()).map(t => ({...t, title: t.title.trim()})),
  }));

  const discs: TrackDisc[] = [];
  let current: TrackDisc | undefined;
  for (const raw of info.tracklist || []) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    // MusicBrainz legacy format: "2-07 Song". No splitting on the hyphens
    // inside a track name (e.g. "Twenty-One").
    const match = /^(\d{1,2})-(\d{1,3})\s+(.+)$/u.exec(trimmed);
    const discNo = match ? Number(match[1]) : current?.position || 1;
    const title = match ? match[3].trim() : trimmed;
    if (!title) continue;
    let disc = discs.find(d => d.position === discNo);
    if (!disc) {
      disc = {position: discNo, format: 'CD', title: '', tracks: []};
      discs.push(disc);
    }
    current = disc;
    const row: ReleaseTrack = {position: match ? Number(match[2]) : disc.tracks.length + 1, title};
    disc.tracks.push(row);
  }
  return discs;
}

export function trackDuration(lengthMs: number | undefined): string | null {
  if (typeof lengthMs !== 'number' || !Number.isFinite(lengthMs) || lengthMs <= 0) return null;
  const seconds = Math.round(lengthMs / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
