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


/** Consecutive strips share the complete same row, including their u parameter. */
export function validPhotoWarpRows(rows: readonly (readonly number[])[]): boolean {
  if (rows.length < 2 || rows.length > 17 || rows.some(row => row.length !== 4 || row.some(n => !Number.isFinite(n) || n < 0 || n > 1))) return false;
  return rows.slice(1).every((row, index) => {
    const previous = rows[index];
    return row[1] > previous[1] && row[3] > previous[3]
      && !!photoProjection([...previous, row[2], row[3], row[0], row[1]]);
  });
}

export function photoWarpPoint(rows: readonly (readonly number[])[], u: number, v: number): [number, number] | null {
  if (!validPhotoWarpRows(rows)) return null;
  const height = Math.max(0, Math.min(1, v)) * (rows.length - 1);
  const index = Math.min(rows.length - 2, Math.floor(height)), t = height - index;
  const a = rows[index], b = rows[index + 1];
  const x = a[0] * (1 - u) + a[2] * u, y = a[1] * (1 - u) + a[3] * u;
  return [x * (1 - t) + (b[0] * (1 - u) + b[2] * u) * t,
    y * (1 - t) + (b[1] * (1 - u) + b[3] * u) * t];
}

/** In-memory ROI only. All supplied rows remain anchored to original pixels. */
export function photoTextureCrop(imageWidth: number, imageHeight: number, region?: readonly number[],
  rows?: readonly (readonly number[])[]) {
  const warp = rows && validPhotoWarpRows(rows) ? rows : undefined;
  const coordinates = warp ? warp.flatMap(row => [...row]) : region && photoProjection(region) ? [...region] : null;
  if (!coordinates) return null;
  const xs = coordinates.filter((_, i) => i % 2 === 0), ys = coordinates.filter((_, i) => i % 2 === 1);
  const x = Math.floor(Math.min(...xs) * imageWidth), y = Math.floor(Math.min(...ys) * imageHeight);
  const width = Math.max(1, Math.min(imageWidth - x, Math.ceil(Math.max(...xs) * imageWidth) - x));
  const height = Math.max(1, Math.min(imageHeight - y, Math.ceil(Math.max(...ys) * imageHeight) - y));
  const project = (values: readonly number[]) => values.map((n, i) => i % 2 ? (n * imageHeight - y) / height : (n * imageWidth - x) / width);
  return {x, y, width, height, region: region ? project(region) : undefined,
    warpRows: warp?.map(row => project(row))};
}
