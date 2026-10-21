// 条码识别器：浏览器原生 BarcodeDetector（Chrome / Android）优先；没有（iPhone Safari）时懒加载 zxing-wasm 垫片。
// wasm 打进本站静态资源（CSP 不允许连外部 CDN），只在第一次扫码时才下载。
export interface Detector {detect: (source: CanvasImageSource) => Promise<{rawValue: string}[]>}
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

export async function makeDetector(): Promise<Detector> {
  const Native = (window as unknown as {BarcodeDetector?: new (o: {formats: string[]}) => Detector}).BarcodeDetector;
  if (Native) {
    try { return new Native({formats: FORMATS}); } catch { /* 格式不被支持，退回垫片 */ }
  }
  const [{BarcodeDetector, setZXingModuleOverrides}, wasm] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  setZXingModuleOverrides({locateFile: (path: string, prefix: string) => path.endsWith('.wasm') ? wasm.default : prefix + path});
  return new BarcodeDetector({formats: FORMATS as never}) as unknown as Detector;
}
