// 「恢复备份」选中文件后先认出它是什么：完整备份包（zip）、旧版 .json 完整备份，或是选错了的文件
// （导出的 CSV 表格、旧的 albums.json 采购记录、别的 zip）。选错时给出该去哪里的提示，而不是一句「格式不对」。
// 完整备份包由 server/archive.py 生成：前两项 manifest.json、ledger.json 不压缩，这里只读文件开头即可取出账本，
// 不用解压库，也不把几百 MB 的包整个读进内存。
import type {BackupFile} from '../types';

export type Inspected =
  | {kind: 'archive'; ledger: BackupFile; files: number}
  | {kind: 'legacy'; ledger: BackupFile}
  | {kind: 'wrong'; message: string};

const ZIP_SIG = 0x04034b50;
const text = new TextDecoder();

async function bytes(file: Blob, start: number, length: number) {
  return new Uint8Array(await file.slice(start, start + length).arrayBuffer());
}

/** 顺序读 zip 开头的本地文件头，取出前几个不压缩的条目（只认 Obi 备份包的布局） */
async function readStoredEntries(file: Blob, wanted: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  let at = 0;
  for (let i = 0; i < wanted.length; i++) {
    const head = await bytes(file, at, 30);
    const view = new DataView(head.buffer);
    if (head.length < 30 || view.getUint32(0, true) !== ZIP_SIG) break;
    const method = view.getUint16(8, true), size = view.getUint32(18, true);
    const nameLen = view.getUint16(26, true), extraLen = view.getUint16(28, true);
    const name = text.decode(await bytes(file, at + 30, nameLen));
    if (method !== 0 || !wanted.includes(name)) break;
    out[name] = text.decode(await bytes(file, at + 30 + nameLen + extraLen, size));
    at += 30 + nameLen + extraLen + size;
  }
  return out;
}

const isLedger = (v: unknown): v is BackupFile => !!v && typeof v === 'object' && (v as BackupFile).format === 'album-ledger';

export async function inspectBackup(file: File): Promise<Inspected> {
  const head = await bytes(file, 0, 4);
  if (head.length === 4 && new DataView(head.buffer).getUint32(0, true) === ZIP_SIG) {
    const entries = await readStoredEntries(file, ['manifest.json', 'ledger.json']);
    try {
      const manifest = JSON.parse(entries['manifest.json'] ?? 'null');
      const ledger = JSON.parse(entries['ledger.json'] ?? 'null');
      if (manifest?.format === 'album-ledger-archive' && isLedger(ledger)) {
        return {kind: 'archive', ledger, files: Object.keys(manifest.files ?? {}).length};
      }
    } catch { /* 落到下面的「不是 Obi 备份包」 */ }
    return {kind: 'wrong', message: '这个 zip 不是 Obi 的完整备份'};
  }
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
    return {kind: 'wrong', message: '这是导出的表格，不能用来恢复，请选 .zip 完整备份'};
  }
  let data: unknown;
  try { data = JSON.parse(await file.text()); } catch {
    return {kind: 'wrong', message: '无法识别这个文件，请选 .zip 完整备份'};
  }
  if (isLedger(data)) return {kind: 'legacy', ledger: data};
  if (Array.isArray(data)) {
    return {kind: 'wrong', message: '这是旧版采购记录（albums.json），不能用来恢复'};
  }
  return {kind: 'wrong', message: '无法识别这个文件，请选 .zip 完整备份'};
}
