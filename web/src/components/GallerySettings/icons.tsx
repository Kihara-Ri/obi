// 展示设置的选项示意图：线性、currentColor，按「选项实际会长成什么样」来画。
import type {ReactNode} from 'react';

const svg = (w: number, body: ReactNode) => (
  <svg viewBox={`0 0 ${w} 28`} width={w} height="28" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{body}</svg>
);
const cells = (n: number, size: number, gap: number, y = 14) => {
  const x0 = (36 - (n * size + (n - 1) * gap)) / 2;
  return Array.from({length: n}, (_, i) => <rect key={i} x={x0 + i * (size + gap)} y={y - size / 2} width={size} height={size} rx="1.5"/>);
};

export const SORT_ICONS = {
  recent: svg(28, <><circle cx="14" cy="14" r="10"/><polyline points="14 8 14 14 18 16"/></>),
  artist: svg(28, <><circle cx="14" cy="10" r="4.5"/><path d="M5 24c1-5 4.5-7.5 9-7.5s8 2.5 9 7.5"/></>),
  title: svg(28, <><path d="M3 22 9 6l6 16M5.2 16.5h7.6"/><path d="M19 10h6M19 15h6M19 20h6"/></>),
  group: svg(28, <><path d="M4 7h20M4 14h20M4 21h12"/></>),
};
export const SIZE_ICONS = {
  small: svg(36, <>{[7, 14, 21].flatMap(y => cells(3, 6, 4, y))}</>),
  medium: svg(36, <>{[8.5, 19.5].flatMap(y => cells(2, 10, 4, y))}</>),
  large: svg(36, <>{cells(1, 22, 0)}</>),
};
export const SPACING_ICONS = {
  none: svg(36, <>{cells(3, 10, 0)}</>),
  tight: svg(36, <>{cells(3, 8, 3)}</>),
  normal: svg(36, <>{cells(3, 7, 5)}</>),
  wide: svg(36, <>{cells(3, 6, 7)}</>),
};
export const AXIS_ICONS = {
  vertical: svg(28, <><path d="M14 3v22M8 8l6-5 6 5M8 20l6 5 6-5"/></>),
  horizontal: svg(28, <><path d="M3 14h22M8 8l-5 6 5 6M20 8l5 6-5 6"/></>),
};
