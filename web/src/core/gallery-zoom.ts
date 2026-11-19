export type ZoomRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
export type ZoomFrame = {transform: string; clipPath: string};

/** Preserve a filled WAAPI opacity before cancelling it, so it cannot snap to CSS. */
export function commitAnimationOpacity(style: {opacity: string}, opacity: number, cancel: () => void): void {
  style.opacity = String(opacity);
  cancel();
}

/** Map an element currently occupying `from` onto the exact rectangle `to`. */
export function zoomTransform(from: ZoomRect, to: ZoomRect): string {
  const x = to.left + to.width / 2 - from.left - from.width / 2;
  const y = to.top + to.height / 2 - from.top - from.height / 2;
  return `translate(${x}px, ${y}px) scale(${to.width / from.width}, ${to.height / from.height})`;
}

/** Same FLIP geometry used by the photo lightbox for opening and closing.
 *  缩略图是 object-fit:cover 裁成的方块：大图按「铺满」等比缩放（不再拉伸变形），多出的部分用
 *  clip-path inset 裁掉，裁切圆角换算回缩放前的尺寸，落到缩略图上正好是它自己的圆角
 *  （2026-11-19：原来非等比缩放 + 只按横向修正圆角，收回时照片被压成方块、圆角也不对）。 */
export function thumbnailZoomFrames(full: ZoomRect, thumbnail: ZoomRect, radius: number, fullRadius: string): [ZoomFrame, ZoomFrame] {
  const s = Math.max(thumbnail.width / full.width, thumbnail.height / full.height);
  const x = thumbnail.left + thumbnail.width / 2 - full.left - full.width / 2;
  const y = thumbnail.top + thumbnail.height / 2 - full.top - full.height / 2;
  const insetX = Math.max(0, (full.width - thumbnail.width / s) / 2);
  const insetY = Math.max(0, (full.height - thumbnail.height / s) / 2);
  const px = (v: number) => `${Math.round(v * 100) / 100}px`;
  return [
    {transform: `translate(${px(x)}, ${px(y)}) scale(${Math.round(s * 1e4) / 1e4})`,
      clipPath: `inset(${px(insetY)} ${px(insetX)} round ${px(Math.max(0, radius) / s)})`},
    {transform: 'none', clipPath: `inset(0px 0px round ${fullRadius})`},
  ];
}

/** 缩略图的可见圆角：圆角常在外层（详情照片墙的 <a>、表单的 .photo-thumb），img 自己是 0，取外层圆角减边框 */
export function thumbRadius(img: Element): number {
  const own = parseFloat(getComputedStyle(img).borderTopLeftRadius);
  const wrap = img.parentElement ? getComputedStyle(img.parentElement) : null;
  const r = own || (wrap ? parseFloat(wrap.borderTopLeftRadius) - (parseFloat(wrap.borderTopWidth) || 0) : 0);
  return Number.isFinite(r) ? Math.max(0, r) : 0;
}

/** 收起动画的起始裁切：取当前（可能是放大动画中途的）clip-path，没有则按元素圆角补一个等效 inset */
export function currentClip(el: Element): string {
  const c = getComputedStyle(el);
  return c.clipPath && c.clipPath !== 'none' ? c.clipPath : `inset(0px 0px round ${c.borderRadius})`;
}

/** Actual painted bounds of an object-fit:contain cover, excluding letterboxing. */
export function containedImageRect(box: ZoomRect, aspect: number): ZoomRect {
  if (!Number.isFinite(aspect) || aspect <= 0 || box.width <= 0 || box.height <= 0) return {...box};
  const width = Math.min(box.width, box.height * aspect);
  const height = width / aspect;
  return {left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2, width, height};
}

/** 缩略图封面的圆角与聚焦后封面卡片的圆角（album-flip-card.css 的 .album-flip-face）；放大过渡里圆角随尺寸一起过渡，避免结束时骤变。 */
export const THUMB_RADIUS = 2, FOCUS_RADIUS = 13;

/** Animate a cover image by its painted bounds, never by stretching a title+scene wrapper. */
export function coverRectFrames(from: ZoomRect, to: ZoomRect, radii?: [number, number]): [Record<string, string>, Record<string, string>] {
  const frame = (rect: ZoomRect, radius?: number) => ({left: `${rect.left}px`, top: `${rect.top}px`,
    width: `${rect.width}px`, height: `${rect.height}px`, ...(radius === undefined ? {} : {borderRadius: `${radius}px`})});
  return [frame(from, radii?.[0]), frame(to, radii?.[1])];
}
