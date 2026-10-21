// BarcodeSheet：把条码数字画成白底黑条的全屏标准条码，方便用扫码器直接扫手机屏幕。
// 照片里的条码常有透视、反光和摩尔纹，扫码器不容易识别；这里按数字重新绘制（core/ean.ts）。
// 点任意处或按 Esc 关闭（Esc 只关这一层，不让详情抽屉跟着关）。
import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {KeyboardEvent} from 'react';
import {encodeEan} from '../core/ean';
import './BarcodeSheet.css';

const QUIET = 10;   // 两侧留白（模块数），EAN 规范要求 ≥ 7–11

function Sheet({code, onClose}: {code: NonNullable<ReturnType<typeof encodeEan>>; onClose: () => void}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const total = code.modules.length + QUIET * 2;
  const bars: number[] = [];
  [...code.modules].forEach((m, i) => { if (m === '1') bars.push(i); });
  const d = code.digits;
  const text = d.length === 8 ? `${d.slice(0, 4)} ${d.slice(4)}` : `${d[0]} ${d.slice(1, 7)} ${d.slice(7)}`;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
  };
  return (
    <div className="barcode-sheet" role="dialog" aria-modal="true" aria-label="条码" onKeyDown={onKey} onClick={onClose}>
      <svg className="barcode-svg" viewBox={`0 0 ${total} 60`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`条码 ${d}`}>
        {bars.map(i => <rect key={i} x={i + QUIET} y="0" width="1.02" height="52"/>)}
        <text x={total / 2} y="59" textAnchor="middle" fontSize="6.5" className="barcode-digits">{text}</text>
      </svg>
      <p className="barcode-hint">{code.valid ? '调高屏幕亮度，对准扫码器 · 点任意处关闭' : '校验位不对，这个条码可能录错了一位 · 点任意处关闭'}</p>
      <button ref={closeRef} type="button" className="barcode-close" aria-label="关闭条码" onClick={onClose}>×</button>
    </div>
  );
}

/** 条码值旁的小按钮；位数不支持扫码绘制（非 EAN / UPC）时不渲染 */
export function BarcodeButton({code}: {code: string}) {
  const [open, setOpen] = useState(false);
  const ean = encodeEan(code);
  if (!ean) return null;
  return <>
    <button type="button" className="quiet barcode-open" aria-label="显示条码，供扫码器扫描" onClick={() => setOpen(true)}>显示条码</button>
    {open ? createPortal(<Sheet code={ean} onClose={() => setOpen(false)}/>, document.body) : null}
  </>;
}
