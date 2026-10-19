// 文件下载：用 fetch 取回后在应用内保存或分享，不做整页跳转。
// 直接 <a href> 指向附件时，iOS 会用“快速查看”盖住整个页面，且（主屏/PWA 模式下）没有返回键。

import {ApiError} from './api';

function fileNameFrom(header: string | null, fallback: string): string {
  const m = header?.match(/filename="([^"]+)"/);
  return m ? m[1] : fallback;
}

// 返回实际保存/分享的文件名；用户在系统分享面板取消时视为成功，不报错。
export async function downloadFile(path: string, fallbackName: string): Promise<string> {
  if (!navigator.onLine) throw new ApiError('网络已断开，请联网后再导出');
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
  if (navigator.canShare?.({files: [file]})) {
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
