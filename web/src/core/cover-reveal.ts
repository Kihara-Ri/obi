// 图片「模糊到清晰」显现：图片读好后，从透明、模糊淡入到清晰（约 0.38 秒）。全站由 core/image-reveal.ts 统一触发。
// 用 Web Animations 播放而不是加 CSS 类：React 重渲染改 className（如封面读完加 is-ready）不会把动画打断。
// 只动 opacity / filter，不缩放、不改布局；每个元素只播一次；减少动态效果时直接显示。
const FRAMES: Keyframe[] = [
  {opacity: 0, filter: 'blur(10px) saturate(.6)'},
  {opacity: 1, offset: .6},
  {opacity: 1, filter: 'none'},
];

export function coverReveal(img: HTMLImageElement) {
  if (img.dataset.revealed) return;
  img.dataset.revealed = '1';
  let reduced = false;
  try {reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;} catch { /* 取不到就当作可以动画 */ }
  if (reduced || typeof img.animate !== 'function') return;
  // 模糊会溢出圆角：用与图片相同的圆角裁掉（clip-path 在 filter 之后生效）
  const clipPath = `inset(0 round ${getComputedStyle(img).borderRadius || '0px'})`;
  img.animate(FRAMES.map(f => ({...f, clipPath})), {duration: 380, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards'});
}
