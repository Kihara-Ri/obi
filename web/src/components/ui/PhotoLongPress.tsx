// 实物照片长按（2026-11-19）：系统长按菜单已关掉（缩略图是链接，iOS 会弹网页预览），
// 改为按住约半秒弹出「保存图片」面板。缩略图与灯箱里的大图都适用；长按后松手补发的 click
// 会被吞掉，不会顺带打开 / 关闭灯箱。
import {useEffect, useRef, useState} from 'react';
import {useApp} from '../../state/AppContext';
import {DownloadIco} from '../icons';
import {savePhoto, touchDevice, usePhotoFile} from './photoSave';
import './PhotoSave.css';

const HOLD_MS = 450, SLOP = 10;
const TARGET = '.photo-strip a img,.photo-thumb img,.lb-slide img';

export function PhotoLongPress() {
  const app = useApp();
  const [src, setSrc] = useState<string | null>(null);
  const {file, failed} = usePhotoFile(src);
  const swallowUntil = useRef(0);
  useEffect(() => {
    let timer = 0, start: {x: number; y: number} | null = null;
    const cancel = () => { window.clearTimeout(timer); start = null; };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || !e.isPrimary) return cancel();
      const img = (e.target as Element).closest?.(TARGET) as HTMLImageElement | null;
      if (!img) return;
      start = {x: e.clientX, y: e.clientY};
      timer = window.setTimeout(() => {
        start = null;
        swallowUntil.current = performance.now() + 900;
        navigator.vibrate?.(10);
        setSrc(img.currentSrc || img.src);
      }, HOLD_MS);
    };
    const move = (e: PointerEvent) => { if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP) cancel(); };
    const click = (e: MouseEvent) => {
      if (performance.now() > swallowUntil.current) return;
      swallowUntil.current = 0;
      e.preventDefault(); e.stopImmediatePropagation();
    };
    // 安卓等仍会给链接 / 图片弹系统菜单：照片上一律拦掉
    const menu = (e: Event) => { if ((e.target as Element).closest?.(TARGET)) e.preventDefault(); };
    const opts = {capture: true, passive: true};
    window.addEventListener('pointerdown', down, opts);
    window.addEventListener('pointermove', move, opts);
    window.addEventListener('pointerup', cancel, opts);
    window.addEventListener('pointercancel', cancel, opts);
    window.addEventListener('click', click, true);
    window.addEventListener('contextmenu', menu, true);
    return () => {
      cancel();
      window.removeEventListener('pointerdown', down, opts);
      window.removeEventListener('pointermove', move, opts);
      window.removeEventListener('pointerup', cancel, opts);
      window.removeEventListener('pointercancel', cancel, opts);
      window.removeEventListener('click', click, true);
      window.removeEventListener('contextmenu', menu, true);
    };
  }, []);
  if (!src) return null;
  const close = () => setSrc(null);
  const save = () => {
    if (!file) return;
    savePhoto(file).then(msg => { if (msg) app.toast(msg); close(); },
      () => { app.toast('保存失败，请重试', 'err'); close(); });
  };
  return (
    <div className="photo-hold" role="dialog" aria-label="照片操作" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="photo-hold-sheet">
        <img src={src} alt=""/>
        <div className="photo-hold-group">
          <button type="button" onClick={save} disabled={!file}>
            {DownloadIco}<span>{failed ? '照片读取失败' : !file ? '正在读取…' : touchDevice() ? '保存到相册' : '下载照片'}</span>
          </button>
        </div>
        <button type="button" className="photo-hold-cancel" onClick={close}>取消</button>
      </div>
    </div>
  );
}
