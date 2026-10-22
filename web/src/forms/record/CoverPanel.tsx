// 封面区块：当前封面缩略图 + 一句清晰的状态 + 「重新匹配」，候选缩略图点选抓取。
// 状态文字用正文字号（匹配通常要几秒，用户需要一眼看到进度）；匹配中显示转圈。
import {useState} from 'react';
import {Chevron, Collapse} from '../../components/ui';
import {SpinIco} from '../../components/icons';
import {dropCandidate, type CoverSearch} from './useCoverSearch';

export function CoverPanel({cover, src, busy, inline}: {cover: CoverSearch; src: string; busy: boolean; inline?: boolean}) {
  const [open, setOpen] = useState(false);
  const many = cover.candidates.length > 1;
  return (
    <section className={'cover-search' + (inline ? ' is-inline' : '')}>
      <div className="cover-row">
        {inline ? null : <span className="cover-thumb">{src ? <img src={src} alt="当前封面"/> : <span aria-hidden="true">无</span>}</span>}
        <div className="cover-info">
          {inline ? null : <strong>封面</strong>}
          <span className={`cover-status${busy ? ' is-busy' : ''}`} role="status">{busy ? SpinIco : null}{cover.coverStatus}</span>
        </div>
        <button type="button" disabled={busy} onClick={() => cover.findCover()}>换一张封面</button>
      </div>
      {cover.candidates.length ? <>
        {many ? <button type="button" className="cover-deck" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="cover-deck-stack" aria-hidden="true">
            {cover.candidates.slice(0, 5).map(c => <img key={c.token} src={c.thumbnail} alt=""/>)}</span>
          <span>{open ? '收起候选' : `${cover.candidates.length} 张候选，点开选择`}</span>
          <Chevron open={open}/>
        </button> : null}
        <Collapse open={open || !many}>
        <ul className="cover-list" aria-label="封面候选">
          {cover.candidates.map(c => <li key={c.token}>
            <button type="button" className="cover-pick" onClick={() => cover.chooseCover(c.token, cover.coverKey())}>
              <img src={c.thumbnail} alt="" onError={() => cover.setCandidates(list => dropCandidate(list, c.token))}/>
              <span><b>{c.title}</b><small>{[c.artist, c.year, c.provider].filter(Boolean).join(' · ')}</small></span>
              <em>使用</em>
            </button></li>)}
        </ul></Collapse>
      </> : null}
    </section>
  );
}
