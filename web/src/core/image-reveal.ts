// 全站图片统一显现（2026-11-20）：任何 <img> 从网络读完时，按查询页的「模糊到清晰」显现
// （core/cover-reveal.ts，约 0.38 秒，Web Animations 播放）。插入页面时已在缓存里的图直接显示，不播动画；
// 每个元素只播一次。不需要的图（图标、动画替身、自己管显现的组件）加 data-no-reveal。
import {coverReveal} from './cover-reveal';

const skip = (img: HTMLImageElement) => !!img.closest('[data-no-reveal]');

function markCached(node: Node) {
  const imgs = node instanceof HTMLImageElement ? [node]
    : node instanceof Element ? Array.from(node.querySelectorAll('img')) : [];
  for (const img of imgs) {
    if (img.complete && img.naturalWidth) img.dataset.revealed = '1';
  }
}

export function installImageReveal(root: Document = document) {
  // 新插入的图若已读好（缓存命中），标记为已显现：之后补发的 load 不再触发动画
  new MutationObserver(records => {
    for (const r of records) r.addedNodes.forEach(markCached);
  }).observe(root.documentElement, {childList: true, subtree: true});
  root.querySelectorAll('img').forEach(img => markCached(img));
  // load 不冒泡，用捕获阶段在文档上统一接住
  root.addEventListener('load', e => {
    const img = e.target;
    if (img instanceof HTMLImageElement && !skip(img)) coverReveal(img);
  }, true);
}
