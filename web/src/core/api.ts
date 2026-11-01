// /api/* 统一封装：断网预检、JSON 序列化、错误携带状态码（401 → 登录跳转）。

import {serverOffline} from './backend';

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function request(url: string, init: RequestInit, message: string) {
  try { return await fetch(url, init); }
  catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError(message);
  }
}

export async function api<T = unknown>(path: string, data?: unknown,
                                       opts?: {signal?: AbortSignal}): Promise<T> {
  if (data !== undefined && serverOffline()) {
    throw new ApiError('网络已断开，输入仍保留，请联网后再保存');
  }
  const r = await request('/api/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: data === undefined ? {} : {'Content-Type': 'application/json'},
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: opts?.signal,   // 迟到的响应由调用方丢弃，不影响既有调用（不传即不中断）
  }, data === undefined ? '网络连接中断，请检查网络后重试'
    : '连接中断，保存结果尚未确认；请保留当前页面，恢复网络后核对');
  let x: { error?: string } | undefined;
  try { x = await r.json(); } catch { /* 非 JSON 响应按通用错误处理 */ }
  if (!r.ok) throw new ApiError(x?.error || '操作失败，请重试', r.status);
  if (x === undefined) throw new ApiError(data === undefined ? '服务器响应不完整，请重试'
    : '服务器响应不完整，保存结果尚未确认；请保留当前页面并核对');
  return x as T;
}

/** 整文件上传（服务端 routes.UPLOAD）：请求体就是文件本身，不经 JSON / base64，几百 MB 的备份包也不翻倍占内存 */
export async function apiUpload<T = unknown>(path: string, file: Blob, type = 'application/zip',
                                             opts?: {signal?: AbortSignal}): Promise<T> {
  if (serverOffline()) throw new ApiError('网络已断开，请联网后再试');
  const r = await request('/api/' + path, {method: 'POST', headers: {'Content-Type': type}, body: file,
    signal: opts?.signal}, '上传连接中断，文件仍保留，可重试上传');
  let x: { error?: string } | undefined;
  try { x = await r.json(); } catch { /* 非 JSON 响应按通用错误处理 */ }
  if (!r.ok) throw new ApiError(x?.error || (r.status === 413 ? '文件过大，服务器拒收' : '上传失败，请重试'), r.status);
  if (x === undefined) throw new ApiError('上传响应不完整，请核对结果后重试');
  return x as T;
}
