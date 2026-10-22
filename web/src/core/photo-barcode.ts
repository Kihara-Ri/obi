// 从实物照片里识别条码：先整张识别，不行再把照片切成互相重叠的 3×3 小块逐块识别
// （照片里的条码通常只占很小一块，整图缩小后识别器看不清）。只接受校验位通过的结果。
// 识别器与相机扫码是同一个（core/barcode-detector）。
import {makeDetector} from './barcode-detector';
import type {Detected, Detector} from './barcode-detector';
import {gs1Valid} from './lookup';

let detectorPromise: Promise<Detector> | null = null;
const detector = () => (detectorPromise ??= makeDetector().catch(error => { detectorPromise = null; throw error; }));

const valid = (list: Detected[]) => list.find(b => /^\d+$/.test(b.rawValue) && gs1Valid(b.rawValue)) ?? null;

/** 条码在照片里的位置，各值为占整张照片宽 / 高的比例 */
export interface BarcodeHit {code: string; box: {x: number; y: number; w: number; h: number} | null}
const rel = (d: Detected, ox: number, oy: number, w: number, h: number): BarcodeHit['box'] =>
  d.boundingBox ? {x: (ox + d.boundingBox.x) / w, y: (oy + d.boundingBox.y) / h, w: d.boundingBox.width / w, h: d.boundingBox.height / h} : null;

async function load(src: string): Promise<ImageBitmap> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return createImageBitmap(img);
}

export async function locateBarcode(src: string): Promise<BarcodeHit | null> {
  const [det, bitmap] = await Promise.all([detector(), load(src)]);
  try {
    const whole = valid(await det.detect(bitmap).catch(() => []));
    if (whole) return {code: whole.rawValue, box: rel(whole, 0, 0, bitmap.width, bitmap.height)};
    const {width: w, height: h} = bitmap;
    const tw = Math.round(w / 2), th = Math.round(h / 2);
    const canvas = document.createElement('canvas');
    canvas.width = tw; canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const ox = Math.round((w - tw) * col / 2), oy = Math.round((h - th) * row / 2);
      ctx.drawImage(bitmap, ox, oy, tw, th, 0, 0, tw, th);
      const hit = valid(await det.detect(canvas).catch(() => []));
      if (hit) return {code: hit.rawValue, box: rel(hit, ox, oy, w, h)};
    }
    return null;
  } finally {
    bitmap.close();
  }
}

export async function barcodeFromPhoto(src: string): Promise<string | null> {
  return (await locateBarcode(src))?.code ?? null;
}

/** 依次识别多张照片，返回第一个有效条码；onProgress 报告正在看第几张 */
export async function barcodeFromPhotos(sources: string[], onProgress?: (done: number) => void): Promise<string | null> {
  for (let i = 0; i < sources.length; i++) {
    onProgress?.(i);
    try {
      const code = await barcodeFromPhoto(sources[i]);
      if (code) return code;
    } catch { /* 这一张解码 / 识别失败，换下一张 */ }
  }
  return null;
}
