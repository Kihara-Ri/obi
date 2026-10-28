// 文件下载：用 fetch 取回后在应用内保存或分享，不做整页跳转。
// 直接 <a href> 指向附件时，iOS 会用“快速查看”盖住整个页面，且（主屏/PWA 模式下）没有返回键。

import {ApiError} from './api';
import {serverOffline} from './backend';

function fileNameFrom(header: string | null, fallback: string): string {
  const m = header?.match(/filename="([^"]+)"/);
  return m ? m[1] : fallback;
}

// 返回实际保存/分享的文件名；用户在系统分享面板取消时视为成功，不报错。
export async function downloadFile(path: string, fallbackName: string, options?: {share?: boolean}): Promise<string> {
  if (serverOffline()) throw new ApiError('网络已断开，请联网后再导出');
  const r = await fetch('/api/' + path, {credentials: 'same-origin'});
  if (!r.ok) {
    let msg = '导出失败，请重试';
    try { msg = (await r.json()).error || msg; } catch { /* 非 JSON 响应用通用文案 */ }
    throw new ApiError(msg, r.status);
  }
  const name = fileNameFrom(r.headers.get('Content-Disposition'), fallbackName);
  const blob = await r.blob();
  const file = new File([blob], name, {type: blob.type});

  // iOS / Android：系统分享面板可以直接“存储到文件”或发送，保存后回到应用
  if (options?.share !== false && navigator.canShare?.({files: [file]})) {
    try {
      await navigator.share({files: [file], title: name});
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return name;
      throw err;
    }
    return name;
  }

  // 桌面浏览器：标准下载，不离开当前页面
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

// 安卓应用里文件直接存进手机（不弹分享面板）：返回「到下载（Download/Obi）」之类的位置说明，接在提示后面；其他环境为空。
export function savedPlace(): string {
  const place = (navigator as unknown as {__obiSavedTo?: string}).__obiSavedTo;
  return place ? `到${place}` : '';
}

// 文件名里的专辑标识：与服务端图片包一致，去掉各系统不允许的字符并限长。
export function photoLabel(artist: string, title: string): string {
  const clean = (v: string) => v.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+|\.+$/g, '').slice(0, 50);
  return [clean(artist), clean(title)].filter(Boolean).join(' - ');
}

const PHOTO_EXT: Record<string, string> = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'};

// 取回本副本全部实物照片为 File（保持原格式与顺序），供手机系统分享面板直接存入相册。
export async function fetchPhotoFiles(id: string, count: number, label: string, revision?: number): Promise<File[]> {
  return Promise.all(Array.from({length: count}, async (_, i) => {
    const r = await fetch(`/api/photo/${id}/${i}${revision === undefined ? '' : `?photoRevision=${revision}`}`, {credentials: 'same-origin'});
    if (!r.ok) throw new ApiError('照片读取失败', r.status);
    const blob = await r.blob();
    const name = `${label ? label + ' - ' : ''}${String(i + 1).padStart(2, '0')}${PHOTO_EXT[blob.type] ?? '.jpg'}`;
    return new File([blob], name, {type: blob.type});
  }));
}
