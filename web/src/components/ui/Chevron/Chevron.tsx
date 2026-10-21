// Chevron：全站唯一的箭头素材（同一个 SVG、同一个尺寸、同一条过渡）。
// dir="down"：下拉/折叠，open 时转 180° 朝上；dir="right"：进入下一级，open 时转到朝下。
// 方向永远靠旋转同一个图形得到；不要在别处再画箭头或用 › ▾ 等字符。
import {ChevDownIco} from '../../icons';
import './Chevron.css';

export interface ChevronProps {
  dir?: 'down' | 'right';
  open?: boolean;
  className?: string;
}

export function Chevron({dir = 'down', open = false, className = ''}: ChevronProps) {
  return <span className={`chev chev-${dir}${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true">{ChevDownIco}</span>;
}
