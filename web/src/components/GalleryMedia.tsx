// 展示用的封面与实物照片：GalleryArtwork（封面，非正方形时铺模糊底）、GalleryPhoto（带重试的照片）。
import {useCallback, useState} from 'react';
import type {CSSProperties} from 'react';
import type {AlbumRecord} from '../types';
import {Cover} from './Cover';
import {isOffSquare, knownCoverAspect, rememberCoverAspect} from '../core/cover-aspect';

/** 仍复用共同封面组件；失效的图片保留与缺封面不同的可见说明。 */
export function GalleryArtwork({record, focused = false}: {record: AlbumRecord; focused?: boolean}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [, setLoaded] = useState(0);   // 封面载入后重算是否需要铺底
  const source = record.cover;
  const failed = !!source && failedSource === source;
  const fail = useCallback(() => setFailedSource(source), [source]);
  if (focused && record.cover && !failed)
    return <img className="gallery-focus-cover" src={record.cover}
      alt={record.title + '封面'} draggable={false} onError={fail}/>;
  // 非正方形封面在等大的格子里会露出空条：用同一张封面的模糊放大版铺底（--art-url，样式见
  // gallery-stage.css），封面本身仍完整 contain，所以放大动画用的几何不变。
  // 性能：只给「明显不是正方形」的封面铺底（多数封面是正方形，零额外开销）；比例在封面载入时记录。
  const backdrop = source && !failed && isOffSquare(knownCoverAspect(source))
    ? {'--art-url': `url(${JSON.stringify(source)})`} as CSSProperties : undefined;
  return <span className={focused ? 'gallery-focus-cover gallery-artwork' : 'gallery-artwork'} data-art-id={record.id}
    style={backdrop} onErrorCapture={fail}
    onLoadCapture={e => {
      const img = e.target as HTMLImageElement;
      if (source && img.naturalWidth) {
        const had = knownCoverAspect(source);
        rememberCoverAspect(source, img.naturalWidth, img.naturalHeight);
        if (had === undefined) setLoaded(n => n + 1);
      }
    }}>
    {<Cover r={failed ? {...record, cover: ''} : record}/>}
    {!source || failed ? <span className="gallery-art-message">
      {failed ? '封面载入失败' : '暂无封面'}
    </span> : null}
  </span>;
}

export function GalleryPhoto({recordId, index}: {recordId: string; index: number}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const source = `/api/photo/${recordId}/${index}`;
  if (failed) return <div className="gallery-photo-error">
    <span>照片 {index + 1} 载入失败</span>
    <button type="button" className="quiet" onClick={() => {setAttempt(a => a + 1); setFailed(false);}}>重试</button>
  </div>;
  // photo-strip 是现有 Lightbox 的入口，链接中的 img 地址由其共用逻辑读取。
  return <a href={source} target="_blank" rel="noopener noreferrer" aria-label={`放大实物照片 ${index + 1}`}>
    <img key={attempt} src={attempt ? `${source}?retry=${attempt}` : source}
         alt={`实物照片 ${index + 1}`} loading="lazy" onError={() => setFailed(true)}/>
  </a>;
}
