// 查询页：库里还没确认发行版的专辑（已售出不算）。点一行 = 带着它去查，找到后直接绑定到这张。
import {useApp} from '../state/AppContext';
import {Thumb} from '../components/Cover';
import {displayReleaseTitle} from '../core/release-metadata';
import {statusName} from '../core/modules';
import {releasePending} from '../core/lookup';
import type {AlbumRecord} from '../types';

export function PendingReleases({onPick}: {onPick: (r: AlbumRecord) => void}) {
  const {state, modules} = useApp();
  const rows = state.records.filter(releasePending);
  if (!rows.length) return null;
  return <section aria-label="待确认发行版" className="lookup-local lookup-pending">
    <h2>待确认发行版 · {rows.length} 张</h2>
    <ul>{rows.map(r => <li key={r.id}>
      <button type="button" onClick={() => onPick(r)}>
        <Thumb r={r}/>
        <span className="ll-text"><strong>{displayReleaseTitle(r.title)}</strong><span>{r.artist}</span></span>
        <span className={`pill ${r.status}`}>{statusName(r.status, modules)}</span>
      </button>
    </li>)}</ul>
  </section>;
}
