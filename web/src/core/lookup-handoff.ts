// 把条码交给「查询」页：照片灯箱识别出条码后写入这里，再跳转到查询页；
// 查询页挂载时（或已在查询页时收到事件）取走并直接搜索。
let pending = '';
export const LOOKUP_QUEUED = 'lookup-queued';

export function queueLookup(code: string) {
  pending = code;
  window.dispatchEvent(new Event(LOOKUP_QUEUED));
}

export function takeLookup(): string {
  const code = pending;
  pending = '';
  return code;
}

// 详情里识别出条码：交给随后打开的编辑表单，在它的「发行版」区块就地查询、核对当前这张的发行版
let pendingRecord = '';
export const DETAIL_BARCODE = 'detail-barcode';
export function takeRecordBarcode(): string {
  const code = pendingRecord;
  pendingRecord = '';
  return code;
}
export function queueRecordBarcode(code: string) { pendingRecord = code; }
