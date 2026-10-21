// 查询页的文字搜索结果：先按专辑列出（封面、年份、类型），点开再看这张专辑的 CD 版本卡片。
// 库里已有的专辑排在最前并标出；版本日本版 / 有条码的在前，其余折叠。
import {useState} from 'react';
import {useApp} from '../state/AppContext';
import {api} from '../core/api';
import {normalizeCatno, ownedAlbums} from '../core/lookup';
import {statusName} from '../core/modules';
import {openDetail} from '../forms/DetailDrawer';
import type {AlbumRecord, ReleaseCandidate, ReleaseInfo} from '../types';
import {LookupCard} from './LookupCard';

export interface AlbumHit {id: string; title: string; artist: string; year: string; kind: string; source: string; cover: string}
const KIND: Record<string, string> = {album: '专辑', ep: 'EP', single: '单曲', other: ''};
const SHOWN = 5;

function Album({hit, owned, confirming, onAdd}: {hit: AlbumHit; owned: AlbumRecord[]; confirming: boolean; onAdd: (c: ReleaseCandidate, info: ReleaseInfo) => void}) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [versions, setVersions] = useState<ReleaseCandidate[] | null>(null);
  const [error, setError] = useState('');
  const [art, setArt] = useState(!!hit.cover);
  const toggle = () => {
    setOpen(!open);
    if (open || versions) return;
    api<{candidates: ReleaseCandidate[]}>('catalog/versions', {id: hit.id})
      .then(r => setVersions(r.candidates)).catch(err => setError(err instanceof Error ? err.message : String(err)));
  };
  const note = owned.length ? `已有 ${owned.length} 张（${owned.map(r => statusName(r.status, app.modules)).join('、')}）` : '还没有';
  // 库里这张的唱片编号（没有条码的旧记录靠它认）：对上的版本打标并排最前
  const mine = new Set(owned.flatMap(r => (r.releaseInfo?.catalogNumber || '').split(' / ').map(normalizeCatno)).filter(Boolean));
  const isMine = (c: ReleaseCandidate) => (c.releaseInfo.catalogNumber || '').split(' / ').some(n => mine.has(normalizeCatno(n)));
  const ordered = versions ? [...versions].sort((a, b) => Number(isMine(b)) - Number(isMine(a))) : [];
  const list = more ? ordered : ordered.slice(0, SHOWN);
  return <li className="album-hit">
    <div className="ah-row">
      <button type="button" className="ah-main" aria-expanded={open} onClick={toggle}>
        <span className="ah-art">{art ? <img src={hit.cover} alt="" loading="lazy" onError={() => setArt(false)}/> : null}</span>
        <span className="ll-text"><strong>{hit.title}</strong><span>{hit.artist}</span>
          <span>{[hit.year, KIND[hit.kind]].filter(Boolean).join(' · ')}</span></span>
      </button>
      {owned.length ? <button type="button" className="ah-owned" onClick={() => openDetail(app, owned[0].id)}>库里已有</button> : null}
    </div>
    {open ? <div className="ah-versions">
      {error ? <p className="lookup-msg is-error" role="alert">{error}</p> : !versions ? <p className="lookup-msg" role="status">读取版本中…</p>
        : !versions.length ? <p className="lookup-msg">没有找到 CD 版本</p> : <ul>
          {list.map(c => <LookupCard key={c.id} c={c} owned={note} tag={isMine(c) ? '库里这张' : undefined} confirming={confirming} onAdd={info => onAdd(c, info)}/>)}
          {!more && versions.length > SHOWN
            ? <button type="button" className="quiet" onClick={() => setMore(true)}>还有 {versions.length - SHOWN} 个版本</button> : null}
        </ul>}
    </div> : null}
  </li>;
}

export function AlbumResults({albums, records, confirming, onAdd}: {
  albums: AlbumHit[]; records: AlbumRecord[]; confirming: boolean; onAdd: (c: ReleaseCandidate, info: ReleaseInfo) => void;
}) {
  const rows = albums.map(hit => ({hit, owned: ownedAlbums(records, hit.title, hit.artist)}))
    .sort((a, b) => Number(!!b.owned.length) - Number(!!a.owned.length));
  return <ul>{rows.map(({hit, owned}) => <Album key={hit.id} hit={hit} owned={owned} confirming={confirming} onAdd={onAdd}/>)}</ul>;
}
