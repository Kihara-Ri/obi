import {useCallback, useState} from 'react';
import {AlbumCover} from '@diedu/album-engine/preview';
import type {AlbumRecord} from '../types';
import {Cover} from './Cover';
import {useApp} from '../state/AppContext';

/** 仍复用共同封面组件；失效的图片保留与缺封面不同的可见说明。 */
export function GalleryArtwork({record, focused = false}: {record: AlbumRecord; focused?: boolean}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const job = useApp().twins.jobs[record.id];
  const preview = !record.cover && job?.status === 'succeeded'
    ? job.entity?.document?.preview ?? job.entity?.surfaces.front : undefined;
  const source = record.cover || (preview ? job?.id + ':' + preview.asset : '');
  const failed = !!source && failedSource === source;
  const fail = useCallback(() => setFailedSource(source), [source]);
  const resolveAsset = useCallback((asset: string) => preview?.asset === asset ? '/api/twin-assets/' + job!.id + '/' + asset : '', [job?.id, preview?.asset]);
  // The focused 2D cover is a single painted image, not a full-width hitbox.
  // Preserve the shared fallback/engine preview below when there is no image.
  if (focused && record.cover && !failed)
    return <img className="gallery-focus-cover" src={record.cover}
      alt={record.title + '封面'} draggable={false} onError={fail}/>;
  return <span className={focused ? 'gallery-focus-cover gallery-artwork' : 'gallery-artwork'}
    onErrorCapture={fail}>
    {preview && !failed ? <AlbumCover surface={preview} resolveAsset={resolveAsset} alt={record.title + '封面'} onError={fail}/>
      : <Cover r={failed ? {...record, cover: ''} : record}/>}
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
