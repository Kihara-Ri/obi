// 本机写操作回执：请求发出前记住标识，未知结果只重试同一个操作（D-041）。
import {isLocalSite} from './backend';

export async function localWrite(url: string, init: RequestInit): Promise<Response> {
  if (!isLocalSite() || init.method !== 'POST') return fetch(url, init);
  const body = init.body instanceof Blob ? await init.body.arrayBuffer()
    : new TextEncoder().encode(String(init.body ?? ''));
  const digest = await crypto.subtle.digest('SHA-256', body);
  const key = 'obi-write:' + url + ':' + Array.from(new Uint8Array(digest),
    b => b.toString(16).padStart(2, '0')).join('');
  // If session storage is unavailable, fail before executing a mutation.
  const existing = sessionStorage.getItem(key);
  const id = existing || crypto.randomUUID();
  sessionStorage.setItem(key, id);
  const headers = new Headers(init.headers);
  headers.set('X-Obi-Operation', id);
  if (existing) headers.set('X-Obi-Retry', '1');
  const response = await fetch(url, {...init, headers});
  if (response.headers.get('X-Obi-Operation-Complete') === '1') sessionStorage.removeItem(key);
  return response;
}
