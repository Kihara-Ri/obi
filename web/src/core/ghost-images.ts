// 切页快照里的封面：克隆出来的 <img> 是新元素，即使地址已在缓存里，插进页面的第一帧也常常还没解码，
// 先画成空白再冒出来——旧页封面「闪一下」。这里把视口里已经显示出来的图片换成 <canvas>，
// 从原图（已解码）同步画一遍；canvas 插进页面第一帧就有内容。跨域图片画进 canvas 只会让它不可读，不影响显示。

/** srcAll / cloneAll：source 与克隆各自的 querySelectorAll('*')，同序一一对应 */
export function freezeImages(srcAll: Element[], cloneAll: Element[]) {
  const vh = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  srcAll.forEach((s, i) => {
    const c = cloneAll[i];
    if (!(s instanceof HTMLImageElement) || !(c instanceof HTMLImageElement) || !s.complete || !s.naturalWidth) return;
    const r = s.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > vh) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const fit = getComputedStyle(s).objectFit;
      const iw = s.naturalWidth, ih = s.naturalHeight, cw = canvas.width, ch = canvas.height;
      // object-fit：cover 裁中间、contain 留边，其余（fill）拉伸，与页面上看到的一致
      const k = fit === 'cover' ? Math.max(cw / iw, ch / ih) : fit === 'contain' ? Math.min(cw / iw, ch / ih) : 0;
      if (k) ctx.drawImage(s, (cw - iw * k) / 2, (ch - ih * k) / 2, iw * k, ih * k);
      else ctx.drawImage(s, 0, 0, cw, ch);
      canvas.className = c.className;
      const st = c.getAttribute('style');
      if (st) canvas.setAttribute('style', st);
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      canvas.style.display = 'block';
      c.replaceWith(canvas);
    } catch { /* 画不了就保留原 <img> */ }
  });
}
