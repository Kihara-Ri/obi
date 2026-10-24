// 编辑表单照片灯箱里的「识别条码并核对发行版」：用应用内的扫码识别器读当前这张照片，识别到有效条码后先在照片上
// 框出条码位置（取景框收拢 + 确认），再发 `record-barcode` 事件，由表单里的发行版检索区块就地查询，核对当前这张的发行版。
// 详情照片墙里不提供（2026-10-24 移除）。
// 识别失败弹 toast，灯箱保持打开，可以翻到拍了条码的那张再试。
import {useEffect, useState} from 'react';
import {locateBarcode} from '../../core/photo-barcode';
import type {BarcodeHit} from '../../core/photo-barcode';
import {useApp} from '../../state/AppContext';

export const RECORD_BARCODE = 'record-barcode';
const HOLD_MS = 950;   // 框住条码后停留的时间，足够看清再跳转

type Box = {left: number; top: number; width: number; height: number};

/** 当前这张照片在屏幕上的位置 × 识别出的相对位置 = 条码的屏幕框（留一圈余量） */
function screenBox(src: string, hit: BarcodeHit): Box | null {
  if (!hit.box) return null;
  const img = Array.from(document.querySelectorAll<HTMLImageElement>('#lightbox .lb-slide img'))
    .find(el => el.getAttribute('src') === src);
  const r = img?.getBoundingClientRect();
  if (!r || !r.width) return null;
  // 斜着的条码识别器只量得出一条细线，框至少给到 64px，免得取景框缩成一根线
  const w = Math.max(hit.box.w * r.width + 16, 64), h = Math.max(hit.box.h * r.height + 16, 64);
  const cx = r.left + (hit.box.x + hit.box.w / 2) * r.width, cy = r.top + (hit.box.y + hit.box.h / 2) * r.height;
  return {left: cx - w / 2, top: cy - h / 2, width: w, height: h};
}

export function LightboxScan({src, onDone}: {src: string; onDone: () => void}) {
  const app = useApp();
  const [state, setState] = useState<'idle' | 'busy' | 'found'>('idle');
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => { setState('idle'); setBox(null); }, [src]);   // 翻到别的照片后清掉上一张的框
  const run = async () => {
    setState('busy');
    try {
      const hit = await locateBarcode(src);
      if (!hit) { setState('idle'); app.toast('这张照片里没有识别到条码，换一张拍了条码的再试', 'warn'); return; }
      setBox(screenBox(src, hit)); setState('found');
      await new Promise(r => window.setTimeout(r, hit.box ? HOLD_MS : 300));
      onDone();
      window.dispatchEvent(new CustomEvent(RECORD_BARCODE, {detail: hit.code}));
    } catch { setState('idle'); app.toast('识别器加载失败，请稍后重试', 'err'); }
  };
  return (
    <>
      {box ? <div className="lb-scan-box" style={box} aria-hidden="true"><i/><i/><i/><i/></div> : null}
      <div className="lb-scan">
        <button type="button" className="lb-scan-btn" disabled={state !== 'idle'} onClick={() => void run()}>
          {state === 'busy' ? '识别中…' : state === 'found' ? '已识别 ✓' : '识别条码并核对发行版'}
        </button>
      </div>
    </>
  );
}
