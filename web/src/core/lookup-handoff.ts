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
