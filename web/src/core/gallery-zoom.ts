export type ZoomRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
export type ZoomFrame = {transform: string; borderRadius: string};

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

/** Same FLIP geometry used by the photo lightbox for opening and closing. */
export function thumbnailZoomFrames(full: ZoomRect, thumbnail: ZoomRect, radius: number, fullRadius: string): [ZoomFrame, ZoomFrame] {
  const scaleX = thumbnail.width / full.width;
  return [
    {transform: zoomTransform(full, thumbnail), borderRadius: `${Math.max(0, radius / scaleX)}px`},
    {transform: 'none', borderRadius: fullRadius},
  ];
}

/** Actual painted bounds of an object-fit:contain cover, excluding letterboxing. */
export function containedImageRect(box: ZoomRect, aspect: number): ZoomRect {
  if (!Number.isFinite(aspect) || aspect <= 0 || box.width <= 0 || box.height <= 0) return {...box};
  const width = Math.min(box.width, box.height * aspect);
  const height = width / aspect;
  return {left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2, width, height};
}

/** Animate a cover image by its painted bounds, never by stretching a title+scene wrapper. */
export function coverRectFrames(from: ZoomRect, to: ZoomRect): [Record<string, string>, Record<string, string>] {
  const frame = (rect: ZoomRect) => ({left: `${rect.left}px`, top: `${rect.top}px`,
    width: `${rect.width}px`, height: `${rect.height}px`});
  return [frame(from), frame(to)];
}
