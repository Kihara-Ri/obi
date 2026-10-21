// EAN / UPC 条码编码：把条码数字画成标准的黑白竖条，让扫码器直接识别。
// 支持 EAN-13、UPC-A（12 位，按前补 0 的 EAN-13 编码，条形与 UPC-A 完全相同）、EAN-8。
// 返回模块序列（'1' 黑 '0' 白，含左右护线与中线）；位数不支持或含非数字返回 null。校验位不对也照画，由界面提示。
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map(code => code.replace(/[01]/g, c => (c === '0' ? '1' : '0')));
const G = R.map(code => [...code].reverse().join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export interface Ean {
  /** 规范化后的位数字（UPC-A 前补 0 成 13 位） */
  digits: string;
  modules: string;
  /** 校验位是否正确 */
  valid: boolean;
}

export function eanValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length - 1; i++) sum += Number(digits[digits.length - 2 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - sum % 10) % 10 === Number(digits[digits.length - 1]);
}

export function encodeEan(input: string): Ean | null {
  const raw = input.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(raw) || ![8, 12, 13].includes(raw.length)) return null;
  const digits = raw.length === 12 ? '0' + raw : raw;
  const d = [...digits].map(Number);
  let modules: string;
  if (digits.length === 8) {
    modules = '101' + d.slice(0, 4).map(n => L[n]).join('') + '01010' + d.slice(4).map(n => R[n]).join('') + '101';
  } else {
    const parity = PARITY[d[0]];
    modules = '101' + d.slice(1, 7).map((n, i) => (parity[i] === 'L' ? L[n] : G[n])).join('')
      + '01010' + d.slice(7).map(n => R[n]).join('') + '101';
  }
  return {digits, modules, valid: eanValid(digits)};
}
