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
