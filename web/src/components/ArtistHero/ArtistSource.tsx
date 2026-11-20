// 「⋯」里的来源与资料管理：资料更新时间与缓存状态、更新资料 / 更换艺人、按另一个名称搜索。
import {useState} from 'react';
import type {SourceState} from '../../core/artists';

export interface ArtistSourceProps {
  sourceState: SourceState;
  manageable: boolean;
  identityInvalid: boolean;
  busy: string | null;
  onRefresh(): void;
  onChangeArtist(): void;
  onSearchName(name: string): void;
}

export function ArtistSource({sourceState, manageable, identityInvalid, busy, onRefresh, onChangeArtist, onSearchName}: ArtistSourceProps) {
  const [name, setName] = useState('');
  const fetchedAt = sourceState.fetchedAt ? sourceState.fetchedAt.replace('T', ' ') : null;
  return (
    <>
      <h4 className="artist-source-title">来源与资料管理</h4>
      <p className="small-note">
        {fetchedAt ? `更新于 ${fetchedAt}` : '资料来源 MusicBrainz'}
        {sourceState.cache === 'stale' || sourceState.error ? ' · 当前显示缓存资料' : ''}
      </p>
      {sourceState.error && !identityInvalid ? <p className="small-note" role="alert">{sourceState.error}</p> : null}
      {manageable ? (
        <>
          <div className="profile-ops">
            <button type="button" disabled={busy === 'refresh'} onClick={onRefresh}>更新资料</button>
            <button type="button" disabled={busy === 'resolve'} onClick={onChangeArtist}>更换艺人</button>
          </div>
          <div className="candidate-search">
            <label className="small-note" htmlFor="artist-correct-name">调整资料搜索名称</label>
            <div className="candidate-search-row">
              <input id="artist-correct-name" value={name} maxLength={500}
                     placeholder="搜索另一位艺人" onChange={e => setName(e.target.value)}/>
              <button type="button" disabled={!name.trim() || !!busy}
                      onClick={() => onSearchName(name.trim())}>搜索</button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
