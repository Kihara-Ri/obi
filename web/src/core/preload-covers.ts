// 预加载封面：转场幕布合上期间先把图片拉进缓存并解码，揭幕后画面里不再有「还在加载」的封面。
// 超时兜底（网络差时不能把用户永远关在幕布后面）；失败的图片当作已完成，由 Cover 自己的兜底处理。
const MAX_COVERS = 48;

function load(url: string): Promise<void> {
  return new Promise(resolve => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { (img.decode ? img.decode() : Promise.resolve()).catch(() => undefined).then(() => resolve()); };
    img.onerror = () => resolve();
    img.src = url;
  });
}

export function preloadCovers(urls: string[], timeoutMs = 5000): Promise<void> {
  const unique = Array.from(new Set(urls.filter(Boolean))).slice(0, MAX_COVERS);
  if (!unique.length) return Promise.resolve();
  return Promise.race([
    Promise.all(unique.map(load)).then(() => undefined),
    new Promise<void>(resolve => window.setTimeout(resolve, timeoutMs)),
  ]);
}
