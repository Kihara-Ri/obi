// 本机模式启动：登记 Service Worker 接管 /api、拉起引擎 Worker、申请持久存储。
// 由 web/src/core/backend.ts 在静态站点（index.html 带 obi-local 标记）上动态载入；有服务器时不会用到。

export class EngineBusy extends Error {}

async function claimByServiceWorker(onStatus) {
  if (!('serviceWorker' in navigator)) throw new Error('这个浏览器不支持 Service Worker，无法在本机使用。');
  const registration = await navigator.serviceWorker.register('/sw.js');
  // 已装过（升级安装包 / 站点发了新版）：先检查更新，有新版就等它预缓存并接管后重开，
  // 否则这次启动仍跑旧缓存里的旧程序，要到下次打开才是新版。断网时检查失败，照常用旧版。
  if (navigator.serviceWorker.controller) {
    await registration.update().catch(() => {});
    if (registration.installing || registration.waiting) {
      onStatus('正在更新…');
      const switched = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), 60000);
        navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timer); resolve(true); }, { once: true });
      });
      if (switched) { location.reload(); await new Promise(() => {}); }
    }
    return;
  }
  await navigator.serviceWorker.ready;
  if (navigator.serviceWorker.controller) return;
  // 首次访问：Service Worker 刚激活，尚未接管本页，等接管后再发 /api 请求
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Service Worker 未能接管页面，请刷新后重试。')), 10000);
    navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

function startEngine(onStatus, start = 'start') {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/local/engine-worker.js');
    worker.onmessage = ({ data }) => {
      if (data.progress) onStatus(data.progress);
      else if (data.ready) resolve(worker);
      else if (data.busy) reject(new EngineBusy('Obi 已在另一个窗口打开，请关闭其他窗口后刷新。'));
      else if (data.error) reject(new Error(data.error));
    };
    worker.onerror = (e) => reject(new Error(e.message || '本机引擎启动失败'));
    worker.postMessage(start);
  });
}

export async function startLocalMode(onStatus) {
  if (!navigator.locks) throw new Error('这个浏览器版本过旧，无法在本机使用。');
  onStatus('正在准备…');
  await claimByServiceWorker(onStatus);
  // 请求浏览器把数据标为持久，降低被系统清理的概率（是否授予由浏览器决定）
  try { await navigator.storage?.persist?.(); } catch { /* 拿不到也不影响使用 */ }
  await startEngine(onStatus);
  // 慢的外网查询单独一个引擎，不拖住账本读写；它没起来也不影响账本，只是这类查询不可用
  startEngine(() => {}, 'start-net').catch(() => {});
}
