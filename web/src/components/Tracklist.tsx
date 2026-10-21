import {useState} from 'react';
import {Chevron} from './ui/Chevron';
import type {ReleaseInfo, ReleaseMedium} from '../types';
import {trackDiscs, trackDuration} from '../core/tracklist';

function DiscTracks({disc, single = false}: {disc: ReleaseMedium; single?: boolean}) {
  return <ol className="record-track-rows" aria-label={single ? '曲目' : `${disc.format || 'CD'} ${disc.position} 的曲目`}>
    {disc.tracks.map((track, index) => <li className="record-track-row" key={`${track.position}-${index}`}>
      <span className="record-track-number" aria-hidden="true">{String(track.position).padStart(2, '0')}</span>
      <span className="record-track-title">{track.title}</span>
      {trackDuration(track.lengthMs) ? <time className="record-track-duration" aria-label={`时长 ${trackDuration(track.lengthMs)}`}>
        {trackDuration(track.lengthMs)}
      </time> : null}
    </li>)}
  </ol>;
}

/** Lightweight, accessible, independent multi-disc toggles. Single-disc releases stay flat. */
export function Tracklist({releaseInfo}: {releaseInfo: ReleaseInfo}) {
  const discs = trackDiscs(releaseInfo);
  const [opened, setOpened] = useState<number[]>(() => discs.length <= 2 ? discs.map((_, i) => i) : [0]);
  if (!discs.length) return null;
  const multiple = discs.length > 1;
  const count = discs.reduce((n, disc) => n + disc.tracks.length, 0);
  const allOpen = discs.every((_, i) => opened.includes(i));
  const toggle = (index: number) => setOpened(previous => previous.includes(index)
    ? previous.filter(value => value !== index) : [...previous, index]);
  return <section className="record-tracklist" aria-label="专辑曲目">
    <div className="record-tracklist-head">
      <h4>曲目 <span>· {count} 首{multiple ? ` · ${discs.length} 碟` : ''}</span></h4>
      {multiple ? <button className="record-tracklist-all" type="button"
        onClick={() => setOpened(allOpen ? [] : discs.map((_, i) => i))}>
        {allOpen ? '全部收起' : '全部展开'}
      </button> : null}
    </div>
    {multiple ? <div className="record-tracklist-discs">
      {discs.map((disc, index) => {
        const isOpen = opened.includes(index);
        return <section className="record-track-disc" key={`${disc.position}-${index}`}>
          <button className="record-track-disc-toggle" type="button" aria-expanded={isOpen}
            onClick={() => toggle(index)}>
            <span className="record-track-disc-icon" aria-hidden="true">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.3"/>
                <path d="M12 4a8 8 0 0 1 8 8" strokeOpacity=".4"/>
              </svg>
            </span>
            <span className="record-track-disc-heading">
              <strong>{disc.format || 'CD'} {disc.position}</strong>
              {disc.title ? <small>{disc.title}</small> : null}
            </span>
            <span className="record-track-disc-count">{disc.tracks.length} 首</span>
            <Chevron open={isOpen}/>
          </button>
          {isOpen ? <DiscTracks disc={disc}/> : null}
        </section>;
      })}
    </div> : <div className="record-track-single">
      {discs[0].title ? <p className="record-track-medium-name">{discs[0].title}</p> : null}
      <DiscTracks disc={discs[0]} single/>
    </div>}
  </section>;
}
