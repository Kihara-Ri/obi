// 快捷取图：只用本副本照片，保留原生长按/拖拽；单张复制在缩略图角上，全部保存在底栏。
import {useState} from 'react';
import {canCopyPhoto, copyPhoto} from '../../core/photo-clipboard';
import {useApp} from '../../state/AppContext';
import {CopyIco, SpinIco} from '../icons';
import './ListingPhotos.css';

type Props = {id: string; count: number; revision: number; files: File[] | null; disabled: boolean; error: string; retry: () => void};
export function ListingPhotos({id, count, revision, files, disabled, error, retry}: Props) {
  const app = useApp();
  const [copying, setCopying] = useState<number>();
  const [state, setState] = useState<Record<number, 'ok' | 'failed'>>({});
  const supported = canCopyPhoto();
  if (!count) return <p className="listing-photo-empty">尚未上传实物照片，可先生成文案。</p>;
  return <section className="listing-photos" aria-label="上架图片">
    <h4 className="listing-photo-heading">实物照片 <span>{count}</span></h4>
    {error ? <button type="button" className="listing-photo-retry" onClick={retry}>照片读取失败，点此重试</button> : null}
    <div className="listing-photo-strip">
      {Array.from({length: count}, (_, i) => <div className={`listing-photo-tile${state[i] ? '' : ' is-loading'}`} key={`${revision}-${i}`}>
        <img src={`/api/photo/${id}/${i}?photoRevision=${revision}`} alt={`实物照片 ${i + 1}`} draggable decoding="async"
          onLoad={() => setState(s => ({...s, [i]: 'ok'}))} onError={() => setState(s => ({...s, [i]: 'failed'}))}/>
        {state[i] === 'failed' ? <span className="listing-photo-failed">加载失败</span> : null}
        {supported ? <button type="button" aria-label={`复制照片 ${i + 1}`} disabled={disabled || !files?.[i] || copying !== undefined}
          aria-busy={copying === i} onClick={() => {
            if (!files?.[i]) return;
            setCopying(i);
            copyPhoto(files[i]).then(() => app.toast('图片已复制，可到支持图片粘贴的位置粘贴'))
              .catch(() => app.toast('复制图片失败，可使用“保存图片”', 'warn')).finally(() => setCopying(undefined));
          }}>{copying === i ? SpinIco : CopyIco}</button> : null}
      </div>)}
    </div>
    <p className="listing-photo-hint">{supported ? '点图片右下角复制单张；发布建议用底栏「保存图片」存到相册后选图。'
      : '长按图片可保存单张；发布建议用底栏「保存图片」存到相册后选图。'}</p>
  </section>;
}
