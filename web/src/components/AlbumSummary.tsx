// 列表中的副本摘要：业务金额与操作由调用方提供，详情/艺人导航互不混用。
import type {ReactNode} from 'react';
import type {AlbumRecord} from '../types';
import {metaTokens} from '../types';
import {ArtistButton} from './ArtistButton';
import {Cover} from './Cover';
import {PackagingIcon} from './PackagingIcon';

export function AlbumSummary({r, onDetail, onArtist, money, actions, coverOverlay, metadata, packagingIconOnly = false}: {
  r: AlbumRecord;
  onDetail: () => void;
  onArtist?: (artist: string) => void;
  money?: ReactNode;
  actions?: ReactNode;
  coverOverlay?: ReactNode;
  metadata?: ReactNode;
  packagingIconOnly?: boolean;
}) {
  const {region, details, packaging} = metaTokens(r);
  const version = [region, ...details, packaging?.name].filter(Boolean).join(' · ');
  return <div className="album-row">
    <div className={`album-summary${actions ? ' has-actions' : ''}`} data-id={r.id}>
      <div className="album-cover">
        <button type="button" className="album-cover-button" aria-label={`查看 ${r.title} 的专辑详情`} onClick={onDetail}>
          <Cover r={r}/>
        </button>
        {coverOverlay}
      </div>
      <div className="album-info">
        <button type="button" className="album-title" title={r.title} onClick={onDetail}><span>{r.title}</span></button>
        {version || metadata ? <div className="album-meta">
          {version ? <div className={packagingIconOnly ? 'album-version packaging-icon-only' : 'album-version'} title={version}>
            {region ? <b className="am-region">{region}</b> : null}
            {details.map(d => <span key={d}>{d}</span>)}
            {packaging ? <span className="am-pkg" role={packagingIconOnly ? 'img' : undefined}
              aria-label={packagingIconOnly ? packaging.name : undefined}>
              <PackagingIcon kind={packaging.kind} height={13}/>
              {packagingIconOnly ? null : packaging.name}
            </span> : null}
          </div> : null}
          {metadata}
        </div> : null}
      </div>
      <div className="album-artist">
        {onArtist ? <ArtistButton artist={r.artist} onOpen={onArtist}/> : <span>{r.artist}</span>}
      </div>
      {money || actions ? <div className="album-aside">
        {money ? <div className="album-money">{money}</div> : null}
        {actions ? <div className="album-actions">{actions}</div> : null}
      </div> : null}
    </div>
  </div>;
}
