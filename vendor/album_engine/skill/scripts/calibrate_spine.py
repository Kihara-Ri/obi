#!/usr/bin/env python3
"""Emit entity calibration from confirmed pixel boundaries; never edit an image or ledger."""
import argparse
import json
import math
import statistics
from pathlib import Path

ROLES = frozenset({'front', 'back', 'spine', 'insideSpine', 'insideLeft', 'insideRight',
                   'insideCenter', 'insideExtra', 'outer'})


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def cross(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def intersect(a, b, c, d):
    """Include touching: a continuous strip may meet only at adjacent vertices."""
    def on_segment(p, q, r):
        return abs(cross(p, q, r)) <= 1e-9 and min(p[0], q[0]) <= r[0] <= max(p[0], q[0]) and min(p[1], q[1]) <= r[1] <= max(p[1], q[1])
    turns = (cross(a, b, c), cross(a, b, d), cross(c, d, a), cross(c, d, b))
    return (turns[0] * turns[1] < 0 and turns[2] * turns[3] < 0) or any(
        (on_segment(a, b, c), on_segment(a, b, d), on_segment(c, d, a), on_segment(c, d, b)))


def boundary_rows(entry, pixels):
    if not isinstance(entry, dict) or set(entry) - {'quad', 'rows'} or ('quad' in entry) == ('rows' in entry):
        raise ValueError('Each surface requires exactly quad (TL/TR/BR/BL pixels) or sampled rows')
    if 'quad' in entry:
        quad = entry['quad']
        if not isinstance(quad, list) or len(quad) != 8:
            raise ValueError('quad requires eight TL/TR/BR/BL pixel coordinates')
        rows = [quad[:4], quad[6:8] + quad[4:6]]
    else:
        rows = entry['rows']
    if not isinstance(rows, list) or not 2 <= len(rows) <= 17:
        raise ValueError('A surface requires 2–17 boundary rows')
    for row in rows:
        if not isinstance(row, list) or len(row) != 4 or not all(finite(n) for n in row):
            raise ValueError('Each row requires four finite pixel coordinates')
        if any(not 0 <= n <= pixels[i % 2] for i, n in enumerate(row)) or row[0] >= row[2]:
            raise ValueError('Boundary coordinates must stay within the original image, left before right')
    for before, after in zip(rows, rows[1:]):
        if before[1] >= after[1] or before[3] >= after[3]:
            raise ValueError('Both boundary heights must strictly increase')
        corners = [before[:2], before[2:], after[2:], after[:2]]
        if any(cross(corners[i], corners[(i + 1) % 4], corners[(i + 2) % 4]) <= 1e-9 for i in range(4)):
            raise ValueError('Each boundary strip must be convex and noncrossing')
    polygon = [row[:2] for row in rows] + [row[2:] for row in reversed(rows)]
    for i, a in enumerate(polygon):
        b = polygon[(i + 1) % len(polygon)]
        for j in range(i + 1, len(polygon)):
            if j == i + 1 or (i == 0 and j == len(polygon) - 1): continue
            if intersect(a, b, polygon[j], polygon[(j + 1) % len(polygon)]):
                raise ValueError('The complete boundary must not cross or touch itself')
    return rows


def calibrate(value):
    if not isinstance(value, dict) or value.get('confirmed') is not True or value.get('samePlane') is not True:
        raise ValueError('Confirm the physical surface boundaries and their common flat image plane first')
    pixels = value.get('pixels')
    if not isinstance(pixels, list) or len(pixels) != 2 or any(not isinstance(n, int) or isinstance(n, bool) or n <= 0 for n in pixels):
        raise ValueError('pixels requires the original positive integer width and height')
    source_id = value.get('sourceId')
    if not isinstance(source_id, str) or not source_id.strip(): raise ValueError('A real image sourceId is required')
    surfaces = value.get('surfaces')
    if not isinstance(surfaces, dict) or set(surfaces) - ROLES or not {'front', 'back', 'spine'} <= set(surfaces):
        raise ValueError('Supply confirmed front, back and spine surfaces from this image')
    panel_role = value.get('panelRole', 'front')
    if panel_role not in ('front', 'back'): raise ValueError('panelRole must be front or back')
    parsed = {role: boundary_rows(entry, pixels) for role, entry in surfaces.items()}
    widths = {role: statistics.median(math.hypot(row[2] - row[0], row[3] - row[1]) for row in rows)
              for role, rows in parsed.items()}
    ratio = widths['spine'] / widths[panel_role]
    if not .001 <= ratio <= .2: raise ValueError('Estimated spine/panel width ratio must be within 0.001–0.2')
    calibration = {'widthRatio': ratio, 'sourceId': source_id, 'basis': 'image-estimate'}
    warnings = ['书脊宽度由同一展平图的折线与单块封板像素宽度估计；透视、斜视缩短和阴影会影响比例，不代表实测毫米。',
                '折线须按实际结构确认，暗印刷或阴影本身不能证明折线或褶皱高度；参考副本的磨损不代表当前副本。']
    if 'reliefMm' in value:
        relief = value['reliefMm']
        if value.get('reliefBasis') != 'approximate-profile':
            raise ValueError('Explicit relief requires reliefBasis: approximate-profile')
        if not isinstance(relief, list) or not 3 <= len(relief) <= 17 or any(not finite(n) or abs(n) > .15 for n in relief):
            raise ValueError('reliefMm requires 3–17 finite samples within ±0.15 mm')
        calibration['reliefMm'] = list(relief)
        warnings.append('沿高度等距的 reliefMm 仅为明确提供的保守形状近似，未从印刷亮度推导，也不代表本副本测量。')
    output_surfaces = {}
    for role, rows in parsed.items():
        normalized = [[n / pixels[i % 2] for i, n in enumerate(row)] for row in rows]
        first, last = normalized[0], normalized[-1]
        output_surfaces[role] = {'sourceId': source_id, 'region': first + last[2:] + last[:2], 'warpRows': normalized}
    return {'surfaces': output_surfaces, 'calibration': {'spine': calibration}, 'warnings': warnings}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='Confirmed original-pixel boundary JSON')
    parser.add_argument('--output', type=Path, required=True, help='A new JSON file in a working directory')
    args = parser.parse_args()
    try:
        if 'data' in args.output.resolve().parts: raise ValueError('Use a separate working directory outside application data')
        result = calibrate(json.loads(args.input.read_text(encoding='utf-8')))
        with args.output.open('x', encoding='utf-8') as output:
            output.write(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    except (OSError, ValueError) as error: parser.exit(1, f'Failed: {error}\n')
    print(json.dumps({'output': str(args.output), 'widthRatio': result['calibration']['spine']['widthRatio'],
                      'basis': 'image-estimate'}, ensure_ascii=False))
    return 0


if __name__ == '__main__': raise SystemExit(main())
