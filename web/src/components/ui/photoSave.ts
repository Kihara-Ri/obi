// 单张实物照片保存（灯箱顶栏与长按面板共用）：手机交给系统分享面板（选「存储图像」进相册），
// 桌面直接下载。分享必须在点按手势内同步调用，所以照片要先取好（见 usePhotoFile）。
import {useEffect, useState} from 'react';
import {savedPlace} from '../../core/download';

export const touchDevice = () => !window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** /api/photo/<id>/<i> → 「实物照片-<i+1>.jpg」；其他地址取末段文件名 */
export async function photoFile(src: string): Promise<File> {
  const r = await fetch(src, {credentials: 'same-origin'});
  if (!r.ok) throw new Error('照片读取失败');
  const blob = await r.blob();
  const m = new URL(src, location.href).pathname.match(/\/api\/photo\/[^/]+\/(\d+)/);
  const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const name = m ? `实物照片-${Number(m[1]) + 1}.${ext}` : decodeURIComponent(src.split('/').pop() || 'photo') ;
  return new File([blob], name.includes('.') ? name : `${name}.${ext}`, {type: blob.type});
}

/** 返回给用户的提示；关闭分享面板返回 ''（不算失败） */
export function savePhoto(file: File): Promise<string> {
  if (touchDevice() && navigator.canShare?.({files: [file]})) {
    return navigator.share({files: [file]}).then(() => `已保存照片${savedPlace()}`, err => {
      if (err instanceof DOMException && err.name === 'AbortError') return '';
      throw err;
    });
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), {href: url, download: file.name});
  document.body.append(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return Promise.resolve('已下载照片');
}

/** 预取当前照片；null = 读取中 */
export function usePhotoFile(src: string | null) {
  const [file, setFile] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFile(null); setFailed(false);
    if (!src) return;
    let alive = true;
    photoFile(src).then(f => { if (alive) setFile(f); }, () => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [src]);
  return {file, failed};
}

/** 只对本站照片接口加重试参数；data:/blob: 等本地地址原样返回 */
export function retrySrc(src: string, attempt: number): string {
  if (!attempt || /^(data|blob):/.test(src) || !src.includes('/api/photo/')) return src;
  return `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`;
}
