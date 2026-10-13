const CACHE='album-shell-v21';
// 离线兜底页与其固定依赖：壳文件在服务器侧 no-store，浏览器缓存不可依赖，
// 全部随 SW 预缓存；其中任何文件改动后须递增 CACHE 版本，否则已装设备离线时仍用旧副本。
const OFFLINE_SHELL=['/offline.html','/offline.css','/theme.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(OFFLINE_SHELL)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('album-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// Never cache API responses, private inventory, sessions, or transaction requests.
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const p=new URL(e.request.url).pathname;
  // 导航失败（离线/服务器不可达）落兜底页；兜底页自身的依赖取不到网络时用预缓存兜底
  if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('/offline.html')));
  else if(OFFLINE_SHELL.includes(p))e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
