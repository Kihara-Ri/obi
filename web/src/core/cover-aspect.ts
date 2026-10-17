// 封面宽高比缓存：封面图第一次加载完成时记下 宽/高，之后同一地址的封面不必等待就能同步取得。
// 灯箱卡片据此按封面真实比例排版（不再被套进固定正方形）。比例限制在 [0.5, 2]，防止异常图撑坏布局。
const cache = new Map<string, number>();

export const MIN_COVER_ASPECT = 0.5;
export const MAX_COVER_ASPECT = 2;

export function clampCoverAspect(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1;
  return Math.min(MAX_COVER_ASPECT, Math.max(MIN_COVER_ASPECT, aspect));
}

export function rememberCoverAspect(src: string, width: number, height: number): void {
  if (src && width > 0 && height > 0) cache.set(src, clampCoverAspect(width / height));
}

export function knownCoverAspect(src: string | undefined): number | undefined {
  return src ? cache.get(src) : undefined;
}

/** 明显不是正方形（偏差 > 4%）：此时在等大正方形格子里才会露出空条，需要铺底。 */
export function isOffSquare(aspect: number | undefined): boolean {
  return aspect !== undefined && Math.abs(aspect - 1) > 0.04;
}
