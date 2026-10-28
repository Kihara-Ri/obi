// 从实物照片里识别条码：先整张识别，不行再把照片切成互相重叠的小块逐块识别
// （照片里的条码通常只占很小一块，整图缩小后识别器看不清）。只接受校验位通过的结果。
// 第一轮用 3×3；整轮都没找到时，等图片稳定后再用更密的 4×4 和一次 90° 旋转重试，仍失败才放弃。
// 识别器与相机扫码是同一个（core/barcode-detector）。
import {makeDetector} from './barcode-detector';
import type {Detected, Detector} from './barcode-detector';
import {gs1Valid} from './lookup';

let detectorPromise: Promise<Detector> | null = null;
const detector = () => (detectorPromise ??= makeDetector().catch(error => { detectorPromise = null; throw error; }));

const valid = (list: Detected[]) => list.find(b => /^\d+$/.test(b.rawValue) && gs1Valid(b.rawValue)) ?? null;

/** 条码在照片里的位置，各值为占整张照片宽 / 高的比例；旋转后的命中不再换算，返回 null */
export interface BarcodeHit {code: string; box: {x: number; y: number; w: number; h: number} | null}
const rel = (d: Detected, ox: number, oy: number, w: number, h: number): BarcodeHit['box'] =>
  d.boundingBox ? {x: (ox + d.boundingBox.x) / w, y: (oy + d.boundingBox.y) / h, w: d.boundingBox.width / w, h: d.boundingBox.height / h} : null;

async function load(src: string): Promise<ImageBitmap> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return createImageBitmap(img);
}

/** 重叠分块：cols×rows 块，每块约占整图 1/((cols+1)/2) 宽，块间重叠一半 */
async function scanGrid(det: Detector, bitmap: ImageBitmap, cols: number, rows: number): Promise<BarcodeHit | null> {
  const {width: w, height: h} = bitmap;
  const tw = Math.round(w * 2 / (cols + 1)), th = Math.round(h * 2 / (rows + 1));
  const canvas = document.createElement('canvas');
  canvas.width = tw; canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const ox = Math.round((w - tw) * col / (cols - 1)), oy = Math.round((h - th) * row / (rows - 1));
    ctx.drawImage(bitmap, ox, oy, tw, th, 0, 0, tw, th);
    const hit = valid(await det.detect(canvas).catch(() => []));
    if (hit) return {code: hit.rawValue, box: rel(hit, ox, oy, w, h)};
  }
  return null;
}

/** 竖着拍的条码横过来认：整张转 90° 再认一次 */
async function scanRotated(det: Detector, bitmap: ImageBitmap): Promise<BarcodeHit | null> {
  const {width: w, height: h} = bitmap;
  const canvas = document.createElement('canvas');
  canvas.width = h; canvas.height = w;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.translate(h, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(bitmap, 0, 0);
  const hit = valid(await det.detect(canvas).catch(() => []));
  return hit ? {code: hit.rawValue, box: null} : null;
}

/** loose：第二轮，跳过已试过的整张与 3×3，直接用 4×4 和旋转 */
export async function locateBarcode(src: string, loose = false): Promise<BarcodeHit | null> {
  const [det, bitmap] = await Promise.all([detector(), load(src)]);
  try {
    if (!loose) {
      const whole = valid(await det.detect(bitmap).catch(() => []));
      if (whole) return {code: whole.rawValue, box: rel(whole, 0, 0, bitmap.width, bitmap.height)};
      return await scanGrid(det, bitmap, 3, 3);
    }
    return (await scanGrid(det, bitmap, 4, 4)) ?? (await scanRotated(det, bitmap));
  } finally {
    bitmap.close();
  }
}

export async function barcodeFromPhoto(src: string, loose = false): Promise<string | null> {
  return (await locateBarcode(src, loose))?.code ?? null;
}

const RETRY_DELAY_MS = 900;

/** 依次识别多张照片，返回第一个有效条码；onProgress 报告正在看第几张。
 *  第一轮没找到时先等图片 / 解码稳定，再用更密的扫描重试一轮（慢一些，但比让用户手动点重试省事）。 */
export async function barcodeFromPhotos(sources: string[], onProgress?: (done: number) => void): Promise<string | null> {
  for (let i = 0; i < sources.length; i++) {
    onProgress?.(i);
    try {
      const code = await barcodeFromPhoto(sources[i]);
      if (code) return code;
    } catch { /* 这一张解码 / 识别失败，换下一张 */ }
  }
  if (!sources.length) return null;
  await new Promise(resolve => window.setTimeout(resolve, RETRY_DELAY_MS));
  for (const src of sources) {
    try {
      const code = await barcodeFromPhoto(src, true);
      if (code) return code;
    } catch { /* 重试仍失败，下一张 */ }
  }
  return null;
}
