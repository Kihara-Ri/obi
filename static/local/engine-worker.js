// 本机引擎 Worker：在浏览器里用 Pyodide 跑同一套 Python 后端，数据存 IndexedDB（IDBFS 挂在 /data）。
// 只在静态站点的「本机模式」下由 boot.js 启动；有服务器时从不加载。决策见 docs/DECISIONS.md D-019。
// 请求从 Service Worker 经 BroadcastChannel 进来（sw.js 的 relay），回复走同一频道。
// Web Lock 保证同一时刻只有一个窗口持有引擎：两个窗口同时写同一份库会互相覆盖。
// 同步 XHR 会占住整个 Worker，所以起两个：main 管账本，net 专管慢的外网查询（条码/封面/汇率），
// 互不阻塞。net 只服务不碰账本的接口（NET_ROUTES），用自己的 /netdata 存缓存；艺人资料要写账本，留在 main。
importScripts('/local/pyodide/pyodide.js');

const channel = new BroadcastChannel('obi-api');
const say = (m) => postMessage(m);
const NET_ROUTES = /^\/api\/(rate|release-details|catalog\/|covers\/(search|download|fallback))/;
let role = 'main';
let engine = null;
let pyodide = null;
let syncing = Promise.resolve();
let syncTimer = 0;

// 同步 XHR：Python 的 urllib 出站请求（MusicBrainz / iTunes / 汇率…）经它发出，受 CORS 约束。
globalThis.obiXhr = (method, url, headersJson, body, timeout) => {
  const x = new XMLHttpRequest();
  const blocked = /^(user-agent|accept-encoding|connection|host|content-length)$/i;
  try {
    x.open(method, url, false);
    x.responseType = 'arraybuffer';
    x.timeout = Math.round(timeout * 1000);
    for (const [k, v] of Object.entries(JSON.parse(headersJson))) if (!blocked.test(k)) x.setRequestHeader(k, v);
    x.send(body && body.toJs ? body.toJs() : body);
  } catch {
    return { status: 0, headers: '', body: new Uint8Array(0), url };
  }
  return { status: x.status, headers: x.getAllResponseHeaders(), body: new Uint8Array(x.response || new ArrayBuffer(0)), url: x.responseURL };
};

const persist = () => {
  syncing = syncing.then(() => new Promise((resolve) => pyodide.FS.syncfs(false, () => resolve())));
  return syncing;
};

async function boot() {
  const dir = role === 'net' ? '/netdata' : '/data';
  say({ progress: '正在载入运行环境…' });
  pyodide = await loadPyodide({ indexURL: '/local/pyodide/' });
  await pyodide.loadPackage('sqlite3');
  say({ progress: '正在载入程序…' });
  const files = await (await fetch('/local/app.json')).json();
  const FS = pyodide.FS;
  for (const [path, text] of Object.entries(files)) {
    FS.mkdirTree('/app/' + path.split('/').slice(0, -1).join('/'));
    FS.writeFile('/app/' + path, text);
  }
  FS.mkdirTree(dir);
  FS.mount(FS.filesystems.IDBFS, {}, dir);
  await new Promise((resolve, reject) => FS.syncfs(true, (err) => (err ? reject(err) : resolve())));
  say({ progress: '正在打开数据…' });
  pyodide.runPython(`
import sys
sys.path.insert(0, '/app')
from js import obiXhr
from server.local_entry import Engine, install_browser_runtime
install_browser_runtime(obiXhr)
engine = Engine('${dir}', seed=${role === 'main' ? 'True' : 'False'})
`);
  engine = pyodide.globals.get('engine');
}

function run(m) {
  const out = engine.handle(m.method, m.target, JSON.stringify(m.headers || {}), m.body ? new Uint8Array(m.body) : null);
  const [status, headers, raw] = out.toJs();
  out.destroy();
  return { status, headers: JSON.parse(headers), body: raw };
}

async function serve(m) {
  let reply;
  try { reply = run(m); } catch (err) {
    reply = { status: 500, headers: { 'Content-Type': 'application/json' }, body: new TextEncoder().encode(JSON.stringify({ error: '本机引擎出错：' + err })) };
  }
  // 写请求先落盘再回复：回复到达页面时数据已进 IndexedDB；读请求顺带产生的缓存稍后合并写入
  if (m.method !== 'GET') { clearTimeout(syncTimer); await persist(); }
  else { clearTimeout(syncTimer); syncTimer = setTimeout(persist, 1500); }
  const body = reply.body instanceof Uint8Array ? reply.body : new Uint8Array(reply.body);
  channel.postMessage({ t: 'res', id: m.id, status: reply.status, headers: reply.headers, body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) });
}

const wanted = (m) => NET_ROUTES.test(m.target.split('?')[0]) === (role === 'net');

onmessage = (event) => {
  if (event.data !== 'start' && event.data !== 'start-net') return;
  role = event.data === 'start-net' ? 'net' : 'main';
  navigator.locks.request(role === 'net' ? 'obi-local-net' : 'obi-local-engine', { ifAvailable: true }, async (lock) => {
    if (!lock) { say({ busy: true }); return; }
    try {
      await boot();
      channel.onmessage = (e) => { if (e.data && e.data.t === 'req' && wanted(e.data)) serve(e.data); };
      say({ ready: true });
    } catch (err) {
      say({ error: String(err && err.message || err) });
      return;
    }
    await new Promise(() => {});   // 持锁直到窗口关闭（Worker 随页面结束，锁自动释放）
  });
};
