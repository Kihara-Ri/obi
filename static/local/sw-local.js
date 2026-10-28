// 静态站点（本机模式）的 Service Worker：构建时复制为站点根的 sw.js，取代服务器版。
// 两件事：① /api/* 不出网，经 BroadcastChannel 交给页面里的 Pyodide 引擎（engine-worker.js）；
// ② 把应用壳与 Pyodide 运行环境整体预缓存，之后断网也能打开。
// 预缓存清单 /local/precache.json 由 web/scripts/build-local.mjs 生成，其 version 变化即触发更新。
const PREFIX = 'obi-local-';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const manifest = await (await fetch('/local/precache.json', { cache: 'no-store' })).json();
    const cache = await caches.open(PREFIX + manifest.version);
    await cache.addAll(manifest.files);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const manifest = await (await fetch('/local/precache.json', { cache: 'no-store' })).json();
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== PREFIX + manifest.version) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) { e.respondWith(relay(e.request)); return; }
  if (e.request.method !== 'GET') return;
  e.respondWith(shell(e.request));
});

// 缓存优先；导航请求落到 index.html（单页应用，hash 路由）
async function shell(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try { return await fetch(req); } catch (err) {
    if (req.mode === 'navigate') { const index = await caches.match('/index.html'); if (index) return index; }
    throw err;
  }
}

// 把请求交给持有引擎的窗口，等同 id 的回复；没人应答按引擎未启动处理
async function relay(req) {
  const body = await req.arrayBuffer();
  return new Promise((resolve) => {
    const channel = new BroadcastChannel('obi-api');
    const id = Math.random().toString(36).slice(2) + Date.now();
    const finish = (res) => { clearTimeout(timer); channel.close(); resolve(res); };
    const url = new URL(req.url);
    // 本机模式下模型分析在请求里就地跑完（不能起线程），给它更长的等待；其他接口仍按 120 秒。
    const timer = setTimeout(() => finish(new Response(JSON.stringify({ error: '本机引擎没有响应，请刷新页面' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } })), url.pathname === '/api/listing/analyze' ? 300000 : 120000);
    channel.onmessage = (ev) => {
      const m = ev.data;
      if (!m || m.t !== 'res' || m.id !== id) return;
      finish(new Response(m.status === 304 ? null : m.body, { status: m.status, headers: m.headers }));
    };
    const headers = {};
    req.headers.forEach((v, k) => { headers[k] = v; });
    channel.postMessage({ t: 'req', id, method: req.method, target: url.pathname + url.search, headers, body: body.byteLength ? body : null });
  });
}
