const CACHE='album-shell-v23';
// 封面缓存：/api/cover/ 按内容哈希命名、不可变，可长期命中；仅缓存成功响应（401/404 不入缓存）。
// 退出登录时由页面清空（web/src/core/cover-cache.ts），此缓存不参与壳缓存的版本清理。
const COVER_CACHE='album-covers';
// 离线兜底页与其固定依赖：壳文件在服务器侧 no-store，浏览器缓存不可依赖，
// 全部随 SW 预缓存；其中任何文件改动后须递增 CACHE 版本，否则已装设备离线时仍用旧副本。
const OFFLINE_SHELL=['/offline.html','/offline.css','/theme.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(OFFLINE_SHELL)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('album-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// Never cache sessions, transaction requests, or other private API responses.
// 唯一例外：内容寻址的封面 /api/cover/（见下方 coverFirst），退出登录时清空（D-009）。
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const p=new URL(e.request.url).pathname;
  if(p.startsWith('/api/cover/')){e.respondWith(coverFirst(e.request));return;}
  // 导航失败（离线/服务器不可达）落兜底页；兜底页自身的依赖取不到网络时用预缓存兜底
  if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('/offline.html')));
  else if(OFFLINE_SHELL.includes(p))e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
// 封面先读本地缓存；未命中则取网络并保存成功响应。
async function coverFirst(req){
  const cache=await caches.open(COVER_CACHE);
  const hit=await cache.match(req);
  if(hit)return hit;
  const res=await fetch(req);
  if(res.ok&&res.status===200)cache.put(req,res.clone());
  return res;
}
