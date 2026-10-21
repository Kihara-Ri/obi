// 封面区块：当前封面缩略图 + 一句清晰的状态 + 「重新匹配」，候选缩略图点选抓取。
// 状态文字用正文字号（匹配通常要几秒，用户需要一眼看到进度）；匹配中显示转圈。
import {SpinIco} from '../../components/icons';
import type {CoverSearch} from './useCoverSearch';

export function CoverPanel({cover, src, busy, inline}: {cover: CoverSearch; src: string; busy: boolean; inline?: boolean}) {
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
      {cover.candidates.length ? <div className="cover-candidates">
        {cover.candidates.map(c => (
          <button key={c.token} type="button" className="cover-choice"
                  onClick={() => cover.chooseCover(c.token, cover.coverKey())}>
            <img src={c.thumbnail} alt=""/>
            <span>{c.title}</span>
            <small>{c.artist} · {c.year}{c.provider ? ' · ' + c.provider : ''}</small>
          </button>
        ))}
      </div> : null}
    </section>
  );
}
