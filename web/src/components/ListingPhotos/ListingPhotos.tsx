// 快捷取图：只用本副本照片，保留原生长按/拖拽；单张复制在缩略图角上，全部保存在底栏。
// 复制不等预取：已预取用现成文件，否则点击时当场取这一张（Promise 交给剪贴板，保留点击手势）。
import {useEffect, useRef, useState} from 'react';
import {canCopyPhoto, copyPhoto} from '../../core/photo-clipboard';
import {useApp} from '../../state/AppContext';
import {CopyIco, SpinIco} from '../icons';
import './ListingPhotos.css';

type Props = {id: string; count: number; revision: number; files: File[] | null; order: number[]; onCover: (index: number) => void;
  disabled: boolean; error: string; retry: () => void};
export function ListingPhotos({id, count, revision, files, order, onCover, disabled, error, retry}: Props) {
  const app = useApp();
  const [copying, setCopying] = useState<number>();
  const [done, setDone] = useState<number>();
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const [state, setState] = useState<Record<number, 'ok' | 'failed'>>({});
  const supported = canCopyPhoto();
  if (!count) return <p className="listing-photo-empty">尚未上传实物照片，可先生成文案。</p>;
  return <section className="listing-photos" aria-label="上架图片">
    <h4 className="listing-photo-heading">实物照片 <span>{count}</span></h4>
    {error ? <button type="button" className="listing-photo-retry" onClick={retry}>照片读取失败，点此重试</button> : null}
    <div className="listing-photo-strip">
      {order.map((i, pos) => <div className={`listing-photo-tile${state[i] ? '' : ' is-loading'}`} key={`${revision}-${i}`}>
        {pos === 0 ? <span className="listing-photo-cover">首图</span>
          : <button type="button" className="listing-photo-setcover" disabled={disabled} aria-label={`设为首图：第 ${pos + 1} 张`} onClick={() => onCover(i)}>设首图</button>}
        <img src={`/api/photo/${id}/${i}?photoRevision=${revision}`} alt={`实物照片 ${pos + 1}`} draggable decoding="async"
          onLoad={() => setState(s => ({...s, [i]: 'ok'}))} onError={() => setState(s => ({...s, [i]: 'failed'}))}/>
        {state[i] === 'failed' ? <span className="listing-photo-failed">加载失败</span> : null}
        {supported ? <button type="button" aria-label={`复制照片 ${pos + 1}`} className={`listing-photo-copy${done === i ? ' is-done' : ''}`}
          aria-busy={copying === i} disabled={disabled} onClick={() => {
            if (copying !== undefined) return; // 复制中忽略连点；不设 disabled，免得其他缩略图按钮跟着闪
            setCopying(i); setDone(undefined);
            const source = files?.[i] ?? fetch(`/api/photo/${id}/${i}?photoRevision=${revision}`).then(r => {
              if (!r.ok) throw new Error('读取照片失败'); return r.blob();
            });
            copyPhoto(source).then(() => {
              setDone(i); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setDone(undefined), 1600);
              app.toast('图片已复制，可到支持图片粘贴的位置粘贴');
            }).catch(() => app.toast('复制图片失败，可使用“保存图片”', 'warn')).finally(() => setCopying(undefined));
          }}>{copying === i ? SpinIco : done === i ? <svg viewBox="0 0 24 24" className="listing-photo-check" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg> : CopyIco}</button> : null}
      </div>)}
    </div>
    <p className="listing-photo-hint">第一张是闲鱼首图，决定列表里怎么展示，点「设首图」可换；底栏「保存图片」按这个顺序存到相册。{supported ? '点图片右下角可复制单张。' : '长按图片可保存单张。'}</p>
  </section>;
}
