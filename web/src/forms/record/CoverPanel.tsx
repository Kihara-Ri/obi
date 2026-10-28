// 封面区块：当前封面缩略图 + 一句清晰的状态 + 「重新匹配」，候选缩略图点选抓取。
// 状态文字用正文字号（匹配通常要几秒，用户需要一眼看到进度）；匹配中显示转圈。
import {useRef, useState} from 'react';
import {Chevron, Collapse} from '../../components/ui';
import {SpinIco} from '../../components/icons';
import {useArtExpand} from '../../components/ReleaseCandidateCard/useArtExpand';
import {dropCandidate, type CoverSearch} from './useCoverSearch';

export function CoverPanel({cover, src, busy, inline}: {cover: CoverSearch; src: string; busy: boolean; inline?: boolean}) {
  const [open, setOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const many = cover.candidates.length > 1;
  const applyUrl = () => {
    if (!url.trim()) return;
    void cover.coverFromUrl(url);
    setUrl('');
  };
  return (
    <section className={'cover-search' + (inline ? ' is-inline' : '')}>
      <div className="cover-row">
        {inline ? null : <span className="cover-thumb">{src ? <img src={src} alt="当前封面"/> : <span aria-hidden="true">无</span>}</span>}
        <div className="cover-info">
          {inline ? null : <strong>封面</strong>}
          <span className={`cover-status${busy ? ' is-busy' : ''}`} role="status">{busy ? SpinIco : null}{cover.coverStatus}</span>
        </div>
        <span className="cover-actions">
          <button type="button" disabled={busy} onClick={() => cover.findCover()}>换一张封面</button>
          <button type="button" disabled={busy} onClick={() => file.current?.click()}>上传封面</button>
          <button type="button" disabled={busy} aria-expanded={urlOpen} onClick={() => setUrlOpen(!urlOpen)}>从网址</button>
        </span>
        <input ref={file} type="file" accept="image/*,.heic,.heif" hidden
          onChange={e => {const f = e.target.files?.[0]; e.target.value = ''; if (f) void cover.uploadCover(f);}}/>
      </div>
      {urlOpen ? <div className="cover-url">
        <input type="url" inputMode="url" autoComplete="off" aria-label="封面图片地址"
          placeholder="粘贴 Bandcamp 封面图片地址（专辑页右键封面 → 复制图片地址）"
          value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyUrl(); } }}/>
        <button type="button" disabled={busy || !url.trim()} onClick={applyUrl}>使用</button>
      </div> : null}
      {cover.candidates.length ? <>
        {many ? <button type="button" className="cover-deck" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="cover-deck-stack" aria-hidden="true">
            {cover.candidates.slice(0, 5).map(c => <img key={c.token} src={c.thumbnail} alt=""/>)}</span>
          <span>{open ? '收起候选' : `${cover.candidates.length} 张候选，点开选择`}</span>
          <Chevron open={open}/>
        </button> : null}
        <Collapse open={open || !many}>
        <ul className="cover-list" aria-label="封面候选">
          {cover.candidates.map(c => <li key={c.token}><CoverPick c={c} cover={cover}/></li>)}
        </ul></Collapse>
      </> : null}
    </section>
  );
}

// 候选行：点缩略图放大（同查询页的 useArtExpand），点行其余部分「使用」
function CoverPick({c, cover}: {c: CoverSearch['candidates'][number]; cover: CoverSearch}) {
  const x = useArtExpand<HTMLButtonElement>('.cover-pick-text,.cover-pick-use');
  return <button type="button" ref={x.head} className={'cover-pick' + (x.big ? ' is-big' : '')}
    onClick={e => { if (!(e.target as Element).closest('.rcc-art-zoom')) cover.chooseCover(c.token, cover.coverKey()); }}>
    <img className="rcc-art-zoom" ref={x.art} src={c.thumbnail} alt="" onClick={x.toggle}
         onError={() => cover.setCandidates(list => dropCandidate(list, c.token))}/>
    <span className="rcc-break" aria-hidden="true"/>
    <span className="cover-pick-text"><b>{c.title}</b><small>{[c.artist, c.year].filter(Boolean).join(' · ')}{c.provider ? <em className="cover-src">{c.provider}</em> : null}</small></span>
    <em className="cover-pick-use">使用</em>
  </button>;
}
