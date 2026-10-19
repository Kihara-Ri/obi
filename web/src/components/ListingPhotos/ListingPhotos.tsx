// 售卖选图：只管理导出清单，不删除原照片；photoRevision 防止导出错图。
import {useState} from 'react';
import {downloadFile} from '../../core/download';
import './ListingPhotos.css';

type Props = {id: string; count: number; revision: number; order: number[]; onChange: (order: number[]) => void};
export function ListingPhotos({id, count, revision, order, onChange}: Props) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const move = (index: number, delta: number) => {
    const next = [...order];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  const display = [...order, ...Array.from({length: count}, (_, i) => i).filter(i => !order.includes(i))];
  return <section className="listing-photos" aria-label="售卖图片">
    <h3 className="section-title">售卖图片 · 已选 {order.length} 张</h3>
    {count ? <p className="small-note">第一张为首图。下载后解压，在闲鱼网页版多选上传。</p> : <p className="small-note">请先在编辑专辑中添加实物照片。</p>}
    <div className="listing-photo-grid photo-strip">
      {display.map(i => {
        const position = order.indexOf(i);
        return <div className="listing-photo" key={i}>
          <a href={`/api/photo/${id}/${i}`} target="_blank" rel="noopener noreferrer">
            <img src={`/api/photo/${id}/${i}`} alt={`实物照片 ${i + 1}`} loading="lazy"/>
          </a>
          <label><input type="checkbox" checked={position >= 0} aria-label={`选用照片 ${i + 1}`}
            onChange={() => onChange(position >= 0 ? order.filter(n => n !== i) : [...order, i])}/>
            {position === 0 ? '首图' : position >= 0 ? `第 ${position + 1} 张` : '不上传'}</label>
          {position >= 0 ? <div className="listing-photo-moves">
            <button type="button" disabled={position === 0} aria-label={`照片 ${i + 1} 前移`} onClick={() => move(position, -1)}>←</button>
            <button type="button" disabled={position === order.length - 1} aria-label={`照片 ${i + 1} 后移`} onClick={() => move(position, 1)}>→</button>
          </div> : null}
        </div>;
      })}
    </div>
    <p role="alert" className="error">{error}</p>
    <button type="button" disabled={!order.length || busy} onClick={async () => {
      setBusy(true); setError('');
      try {await downloadFile(`listing/photos?id=${id}&photoRevision=${revision}&order=${order.join(',')}`, 'listing-photos.zip',
        {share: !window.matchMedia('(hover: hover) and (pointer: fine)').matches});}
      catch (e) {setError(e instanceof Error ? e.message : '图片下载失败');}
      finally {setBusy(false);}
    }}>{busy ? '正在打包…' : '下载所选图片包'}</button>
  </section>;
}
