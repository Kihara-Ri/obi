// 后端接入：服务器部署什么都不做；静态站点（index.html 带 obi-local 标记）先在浏览器里启动本机引擎。
// 本机引擎 = Pyodide 里的同一套 Python 后端，/api/* 由 Service Worker 转交（static/local/）。

const BOOT_MODULE = '/local/boot.js';

function showStatus(text: string): void {
  const el = document.querySelector('#boot-splash .splash-text');
  if (el) el.textContent = text;
}

export function isLocalSite(): boolean {
  return !!document.querySelector('meta[name="obi-local"]');
}

/** 服务器版断网才算「不可用」；本机站点的读写都在手机 / 浏览器里完成，只有外网检索才需要联网，由用到时就地提示。 */
export function serverOffline(): boolean {
  return !navigator.onLine && !isLocalSite();
}

/** 本机站点：引擎就绪后才返回；失败给出原因并抛出，页面不再往下渲染。服务器部署：立即返回。 */
export async function ensureBackend(): Promise<void> {
  if (!isLocalSite()) return;
  try {
    const boot = await import(/* @vite-ignore */ BOOT_MODULE);
    await boot.startLocalMode(showStatus);
  } catch (err) {
    showStatus(err instanceof Error ? err.message : '本机引擎启动失败，请刷新后重试。');
    throw err;
  }
}
