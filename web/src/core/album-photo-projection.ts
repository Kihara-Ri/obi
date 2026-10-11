/** Map a printed plane to a quadrilateral in the untouched source photograph.
 * Coordinates are TL, TR, BR, BL, with image origin at the top left. */
export function photoProjection(region: readonly number[]): [number, number, number, number, number, number, number, number, number] | null {
  if (region.length !== 8 || region.some(n => !Number.isFinite(n) || n < 0 || n > 1)) return null;
  const points = Array.from({length: 4}, (_, i) => [region[i * 2], region[i * 2 + 1]]);
  const turns = points.map(([x, y], i) => {
    const [nx, ny] = points[(i + 1) % 4], [fx, fy] = points[(i + 2) % 4];
    return (nx - x) * (fy - ny) - (ny - y) * (fx - nx);
  });
  if (!turns.every(n => n > 1e-8) && !turns.every(n => n < -1e-8)) return null;
  const [x0, y0, x1, y1, x2, y2, x3, y3] = region;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < 1e-12) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;
  if ([1 + g, 1 + h, 1 + g + h].some(n => !Number.isFinite(n) || n <= 1e-9)) return null;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0,
    y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}
