// 快捷取图：只用本副本照片，保留原生长按/拖拽，单张复制与全部保存各有入口。
import {useState} from 'react';
import {canCopyPhoto, copyPhoto} from '../../core/photo-clipboard';
import {useApp} from '../../state/AppContext';
import {CopyIco, SpinIco} from '../icons';
import './ListingPhotos.css';

type Props = {id: string; count: number; revision: number; files: File[] | null; disabled: boolean; error: string; retry: () => void};
export function ListingPhotos({id, count, revision, files, disabled, error, retry}: Props) {
  const app = useApp();
  const [copying, setCopying] = useState<number>();
  const supported = canCopyPhoto();
  if (!count) return <p className="listing-photo-empty">尚未上传实物照片，可先生成文案。</p>;
  return <section className="listing-photos" aria-label="上架图片">
    <div className="listing-photo-heading"><h4>实物照片 <span>{count}</span></h4>
      <span>单张复制 · 全部保存</span></div>
    {error ? <button type="button" onClick={retry}>照片读取失败，点此重试</button> : null}
    <div className="listing-photo-strip">
      {Array.from({length: count}, (_, i) => <div className="listing-photo-tile" key={`${revision}-${i}`}>
        <img src={`/api/photo/${id}/${i}?photoRevision=${revision}`} alt={`实物照片 ${i + 1}`} draggable/>
        {supported ? <button type="button" aria-label={`复制照片 ${i + 1}`} disabled={disabled || !files?.[i] || copying !== undefined}
          aria-busy={copying === i} onClick={() => {
            if (!files?.[i]) return;
            setCopying(i);
            copyPhoto(files[i]).then(() => app.toast('图片已复制，可到支持图片粘贴的位置粘贴'))
              .catch(() => app.toast('复制图片失败，可使用“保存图片”', 'warn')).finally(() => setCopying(undefined));
          }}>{copying === i ? SpinIco : CopyIco}<span>复制</span></button> : <span>长按保存</span>}
      </div>)}
    </div>
    <p className="listing-photo-hint">发布建议保存到相册后选图；粘贴图片取决于闲鱼支持。</p>
  </section>;
}
