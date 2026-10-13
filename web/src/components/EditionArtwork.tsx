import {useEffect, useState} from 'react';
import {api} from '../core/api';

type Artwork = {id: string; types: string[]; thumbnail: string};

/** Only ever inspect artwork belonging to the explicitly confirmed MB release UUID. */
export function EditionArtwork({releaseId}: {releaseId: string}) {
  const [artwork, setArtwork] = useState<Artwork[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let live = true;
    setState('loading');
    setArtwork([]);
    api<{id: string; artwork: Artwork[]}>('catalog/artwork?id=' + encodeURIComponent(releaseId))
      .then(result => {
        if (!live || result.id !== releaseId) return;
        setArtwork(result.artwork);
        setState('ready');
      }).catch(() => {if (live) setState('error');});
    return () => {live = false;};
  }, [releaseId]);
  return <div className="edition-artwork" aria-live="polite">
    {state === 'loading' ? <p className="small-note">正在读取已确认发行版的图集…</p> : null}
    {state === 'error' ? <p className="small-note">该发行版的图集暂不可用，资料仍已保存，可以稍后重试。</p> : null}
    {state === 'ready' && !artwork.length ? <p className="small-note">Cover Art Archive 尚未收录这一发行版的实物图集，不会借用其他版本。</p> : null}
    {state === 'ready' && artwork.length ? <>
      <p className="small-note">同一发行版本收录 {artwork.length} 张图：仅展示来源已有的正面、背面、内页及盘面等素材。</p>
      <div className="edition-artwork-grid">{artwork.slice(0, 16).map(item => <figure key={item.id}>
        {item.thumbnail ? <img alt={item.types.join('、') || '发行版图'} src={item.thumbnail} loading="lazy"/> : <span>暂无预览</span>}
        <figcaption>{item.types.join(' · ') || '其他图'}</figcaption>
      </figure>)}</div>
    </> : null}
    <a href={'https://coverartarchive.org/release/' + releaseId}
      target="_blank" rel="noopener noreferrer">查看此版本 Cover Art Archive 图集 ↗</a>
  </div>;
}
