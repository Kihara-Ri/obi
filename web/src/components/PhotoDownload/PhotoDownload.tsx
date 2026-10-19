// 实物照片下载图标：手机把原图交给系统分享面板（选“存储图像”直接进相册，无需解压），桌面下载按专辑命名的 ZIP。
import {useEffect, useRef, useState} from 'react';
import {downloadFile, fetchPhotoFiles, photoLabel} from '../../core/download';
import {DownloadIco} from '../icons';
import {useApp} from '../../state/AppContext';
import './PhotoDownload.css';

type Props = {id: string; count: number; revision: number; artist: string; title: string};
type Prep = 'loading' | 'ready' | 'failed';

export function PhotoDownload({id, count, revision, artist, title}: Props) {
  const app = useApp();
  const touch = useRef(!window.matchMedia('(hover: hover) and (pointer: fine)').matches).current;
  const files = useRef<File[]>([]);
  const [prep, setPrep] = useState<Prep>(touch ? 'loading' : 'ready');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!touch) return;
    let alive = true;
    files.current = []; setPrep('loading');
    fetchPhotoFiles(id, count, photoLabel(artist, title)).then(list => {
      if (alive) {files.current = list; setPrep('ready');}
    }).catch(() => {if (alive) setPrep('failed');});
    return () => {alive = false;};
  }, [id, count, revision, artist, title, touch]);
  const zip = () => {
    setBusy(true);
    const order = Array.from({length: count}, (_, i) => i).join(',');
    downloadFile(`listing/photos?id=${id}&photoRevision=${revision}&order=${order}`, 'listing-photos.zip', {share: false})
      .catch(e => app.toast(e instanceof Error ? e.message : '下载失败，请重试', 'err'))
      .finally(() => setBusy(false));
  };
  const onClick = () => {
    if (touch && prep === 'ready' && navigator.canShare?.({files: files.current})) {
      // 必须在点击手势内同步调用；先 await 再分享会被 iOS 拒绝，所以照片在进入详情时已预取。
      navigator.share({files: files.current}).catch(err => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) app.toast('保存失败，请重试', 'err');
      });
    } else zip();
  };
  const label = touch ? '保存实物照片到相册' : '下载实物照片';
  return <button type="button" className="photo-download" aria-label={label} title={label}
    disabled={busy || (touch && prep === 'loading')} onClick={onClick}>{DownloadIco}</button>;
}
