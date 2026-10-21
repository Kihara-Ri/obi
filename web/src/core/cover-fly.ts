// 封面飞行：从库存卡片 / 列表行的封面飞进详情抽屉（打开），关闭时飞回原处。
// 抽屉自己在做滑入 / 滑出，所以用一张 fixed 的克隆图承担飞行，目标位置按抽屉动画终点量，不被滑动中的位移带偏。
// 找不到来源（从艺人页等进入、来源不在屏幕上）或开了减少动态效果就什么都不做。
const OPEN_MS = 480;
const CLOSE_MS = 340;
const EASE = 'cubic-bezier(.2,.8,.3,1)';

export function reducedMotion(): boolean {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
}

/** 页面（抽屉之外）里这张专辑的封面；需要在视口内才算 */
export function originCover(id: string): HTMLElement | null {
  for (const card of document.querySelectorAll<HTMLElement>('.card[data-id]')) {
    if (card.dataset.id !== id || card.closest('#panel')) continue;
    const el = card.querySelector<HTMLElement>('.cover');
    const r = el?.getBoundingClientRect();
    if (el && r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight) return el;
  }
  return null;
}

/** 元素在其所在抽屉动画「播完」时的位置（滑入中的当前位移不算） */
export function finalRect(el: HTMLElement): DOMRect {
  const anims = (el.closest('.drawer') ?? el).getAnimations();
  const saved = anims.map(a => a.currentTime);
  anims.forEach(a => { a.currentTime = Number(a.effect?.getComputedTiming().endTime ?? 0); });
  const rect = el.getBoundingClientRect();
  anims.forEach((a, i) => { a.currentTime = saved[i]; });
  return rect;
}

function fly(src: HTMLImageElement, from: DOMRect, to: DOMRect, ms: number, radius: string): Promise<void> {
  const clone = document.createElement('img');
  clone.src = src.currentSrc || src.src;
  clone.alt = '';
  clone.setAttribute('aria-hidden', 'true');
  Object.assign(clone.style, {
    position: 'fixed', left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`,
    objectFit: 'cover', borderRadius: radius, zIndex: '3000', pointerEvents: 'none', transformOrigin: '0 0',
    boxShadow: 'var(--shadow)',
  });
  document.body.appendChild(clone);
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const a = clone.animate([
    {transform: `translate(${dx}px,${dy}px) scale(${from.width / to.width},${from.height / to.height})`},
    {transform: 'none'},
  ], {duration: ms, easing: EASE});
  return a.finished.then(() => undefined, () => undefined).then(() => clone.remove());
}

/** 打开：来源封面 → 详情大图（大图在飞行结束前隐藏） */
export function flyIn(id: string, big: HTMLElement) {
  const img = big.querySelector<HTMLImageElement>('img.cover');
  const origin = originCover(id);
  if (!img || !origin || reducedMotion()) return;
  const from = origin.getBoundingClientRect();
  const to = finalRect(big);
  big.style.visibility = 'hidden';
  fly(img, from, to, OPEN_MS, getComputedStyle(big).borderRadius).then(() => { big.style.visibility = ''; });
}

/** 关闭：详情大图 → 来源封面（来源已不在屏幕上则不飞） */
export function flyOut(id: string, big: HTMLElement) {
  const img = big.querySelector<HTMLImageElement>('img.cover');
  const origin = originCover(id);
  if (!img || !origin || reducedMotion() || getComputedStyle(big).visibility === 'hidden') return;
  const from = big.getBoundingClientRect();
  if (from.width <= 0) return;
  big.style.visibility = 'hidden';
  fly(img, from, origin.getBoundingClientRect(), CLOSE_MS, getComputedStyle(big).borderRadius);
}
