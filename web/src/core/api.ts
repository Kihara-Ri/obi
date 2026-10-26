// /api/* 统一封装：断网预检、JSON 序列化、错误携带状态码（401 → 登录跳转）。

import {serverOffline} from './backend';

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(path: string, data?: unknown,
                                       opts?: {signal?: AbortSignal}): Promise<T> {
  if (data !== undefined && serverOffline()) {
    throw new ApiError('网络已断开，输入仍保留，请联网后再保存');
  }
  const r = await fetch('/api/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: data === undefined ? {} : {'Content-Type': 'application/json'},
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: opts?.signal,   // 迟到的响应由调用方丢弃，不影响既有调用（不传即不中断）
  });
  let x: { error?: string } | undefined;
  try { x = await r.json(); } catch { /* 非 JSON 响应按通用错误处理 */ }
  if (!r.ok) throw new ApiError(x?.error || '操作失败，请重试', r.status);
  return x as T;
}

/** 整文件上传（服务端 routes.UPLOAD）：请求体就是文件本身，不经 JSON / base64，几百 MB 的备份包也不翻倍占内存 */
export async function apiUpload<T = unknown>(path: string, file: Blob, type = 'application/zip'): Promise<T> {
  if (serverOffline()) throw new ApiError('网络已断开，请联网后再试');
  const r = await fetch('/api/' + path, {method: 'POST', headers: {'Content-Type': type}, body: file});
  let x: { error?: string } | undefined;
  try { x = await r.json(); } catch { /* 非 JSON 响应按通用错误处理 */ }
  if (!r.ok) throw new ApiError(x?.error || (r.status === 413 ? '文件过大，服务器拒收' : '上传失败，请重试'), r.status);
  return x as T;
}
