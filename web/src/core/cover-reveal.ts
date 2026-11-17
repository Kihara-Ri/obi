// 封面「模糊到清晰」显现：真实封面加载好后，从透明、模糊淡入到清晰（约 0.38 秒，样式见 styles/components.css 的 .cover-reveal）。
// 只给图片加一个 CSS 动画类：不逐帧改遮罩、不建画布，iOS 上不会闪。每个元素只播一次；减少动态效果时直接显示。
export function coverReveal(img: HTMLImageElement) {
  if (img.dataset.revealed) return;
  img.dataset.revealed = '1';
  let reduced = false;
  try {reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;} catch { /* 取不到就当作可以动画 */ }
  if (reduced) return;
  // 模糊会溢出圆角：用与图片相同的圆角裁掉（clip-path 在 filter 之后生效）
  img.style.setProperty('--reveal-r', getComputedStyle(img).borderRadius || '0px');
  img.classList.add('cover-reveal');
  img.addEventListener('animationend', () => img.classList.remove('cover-reveal'), {once: true});
}
