// 实物照片下载图标：手机把原图交给系统分享面板（选“存储图像”直接进相册，无需解压），桌面下载按专辑命名的 ZIP。
// 状态靠图标形状区分：下载箭头（可点）→ 转圈（读取 / 保存中，不可点）→ 对勾（刚完成）；完成与失败各弹一条提示。
import {useEffect, useRef, useState} from 'react';
import {downloadFile, fetchPhotoFiles, photoLabel, savedPlace} from '../../core/download';
import {CheckIco, DownloadIco, SpinIco} from '../icons';
import {useApp} from '../../state/AppContext';
import './PhotoDownload.css';

type Props = {id: string; count: number; revision: number; artist: string; title: string};
type Prep = 'loading' | 'ready' | 'failed';
type Phase = 'idle' | 'saving' | 'done';

export function PhotoDownload({id, count, revision, artist, title}: Props) {
  const app = useApp();
  const touch = useRef(!window.matchMedia('(hover: hover) and (pointer: fine)').matches).current;
  const files = useRef<File[]>([]);
  const [prep, setPrep] = useState<Prep>(touch ? 'loading' : 'ready');
  const [phase, setPhase] = useState<Phase>('idle');
  const doneTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(doneTimer.current), []);
  useEffect(() => {
    if (!touch) return;
    let alive = true;
    files.current = []; setPrep('loading');
    fetchPhotoFiles(id, count, photoLabel(artist, title)).then(list => {
      if (alive) {files.current = list; setPrep('ready');}
    }).catch(() => {if (alive) setPrep('failed');});
    return () => {alive = false;};
  }, [id, count, revision, artist, title, touch]);
  const finish = (message: string) => {
    app.toast(message);
    setPhase('done');
    doneTimer.current = window.setTimeout(() => setPhase('idle'), 2200);
  };
  const fail = (message: string) => {app.toast(message, 'err'); setPhase('idle');};
  const zip = () => {
    setPhase('saving');
    const order = Array.from({length: count}, (_, i) => i).join(',');
    downloadFile(`listing/photos?id=${id}&photoRevision=${revision}&order=${order}`, 'listing-photos.zip', {share: false})
      .then(() => finish(`已下载 ${count} 张照片（ZIP）`))
      .catch(e => fail(e instanceof Error ? e.message : '下载失败，请重试'));
  };
  const onClick = () => {
    if (phase === 'saving') return;
    if (touch && prep === 'ready' && navigator.canShare?.({files: files.current})) {
      // 必须在点击手势内同步调用；先 await 再分享会被 iOS 拒绝，所以照片在进入详情时已预取。
      setPhase('saving');
      navigator.share({files: files.current})
        .then(() => finish(`已保存 ${count} 张照片${savedPlace()}`))
        .catch(err => {
          if (err instanceof DOMException && err.name === 'AbortError') setPhase('idle'); // 关闭分享面板：不算失败
          else fail('保存失败，请重试');
        });
    } else zip();
  };
  const loading = touch && prep === 'loading';
  const label = loading ? '正在读取照片…' : phase === 'saving' ? '保存中…' : touch ? '保存实物照片到相册' : '下载实物照片';
  return <button type="button" className={`photo-download${phase === 'done' ? ' is-done' : ''}`}
    aria-label={label} title={label} aria-busy={loading || phase === 'saving'}
    disabled={loading || phase === 'saving'} onClick={onClick}>
    {loading || phase === 'saving' ? SpinIco : phase === 'done' ? CheckIco : DownloadIco}
  </button>;
}
