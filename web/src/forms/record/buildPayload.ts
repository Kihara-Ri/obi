// 保存载荷：以打开时的快照合并表单值；隐藏的购买信息沿用原值，改动金额/币种/日期后清空实际成本。
import {remapPackagingPhotos} from '../../core/album-packaging';
import {prefs} from '../../core/prefs';
import type {AlbumRecord, Status} from '../../types';
import type {RecordValues} from './context';
import type {PhotoSlot} from '../../core/photos';

export function buildPayload(base: Partial<AlbumRecord>, v: RecordValues, where: Status | null,
                             slots: PhotoSlot[], acquisition: boolean) {
  const payload: Record<string, unknown> = {...base, ...v, status: v.status || where || base.status};
  delete payload.cost;
  delete payload.rate;
  const openedPrice = base.currency === 'JPY' && base.price !== ''
    ? String(Math.round(Number(base.price))) : (base.price || '');
  if (acquisition && (v.price !== openedPrice || v.currency !== base.currency || v.date !== base.date)) payload.actual = '';
  if (!acquisition) {
    // 隐藏的购买信息沿用原值；编辑收藏资料不能补日期或清空原金额。
    for (const key of ['price', 'date', 'currency', 'location', 'fees', 'actual'] as const)
      payload[key] = base[key] ?? (key === 'currency' ? 'CNY' : key === 'fees' ? '0' : '');
  }
  const ok = slots.map((_, i) => i).filter(i => !('error' in slots[i]));
  payload.photos = ok.map(i => 'existing' in slots[i] ? (slots[i] as {existing: number}).existing : (slots[i] as {data: string}).data);
  payload.packaging = remapPackagingPhotos(v.packaging, ok);
  if (acquisition) {
    prefs.set('location', v.location);
    prefs.set('currency', v.currency);
  }
  return payload;
}
