// 照片槽管理：占位（处理中）→ 并发池压缩回填；上限 30 张；删除任意位置。
import {useEffect, useRef, useState} from 'react';
import {isPending, MAX_PHOTOS, PhotoQueue, PhotoSlot} from '../core/photos';
import {isLocalSite} from '../core/backend';
import {PhotoTransferQueue} from '../core/photo-transfer';

export function usePhotoSlots(initial: PhotoSlot[], notify: (m: string, kind?: 'warn' | 'err') => void) {
  const [slots, setSlots] = useState<PhotoSlot[]>(initial);
  const live = useRef(slots);
  const active = useRef(true);
  const transfers = useRef<PhotoTransferQueue | null>(null);
  const tasks = useRef(new Map<string, Promise<string>>());
  const queue = useRef(new PhotoQueue());
  const server = !isLocalSite();
  const update = (change: (before: PhotoSlot[]) => PhotoSlot[]) => {
    if (!active.current) return;
    live.current = change(live.current);
    setSlots(live.current);
  };
  useEffect(() => {
    active.current = true;
    transfers.current = new PhotoTransferQueue();
    return () => { active.current = false; transfers.current?.dispose(); };
  }, []);

  const upload = (token: string, data: string) => {
    if (!server || tasks.current.has(token) || !transfers.current) return;
    update(prev => prev.map(p => p.token === token && 'data' in p ? {...p, transfer: 'uploading'} : p));
    const job = transfers.current.add(data, token).then(ref => {
      update(prev => prev.map(p => p.token === token && 'data' in p ? {...p, upload: ref, transfer: undefined, transferError: undefined} : p));
      return ref;
    }).catch(error => {
      update(prev => prev.map(p => p.token === token && 'data' in p ? {...p, transfer: 'failed', transferError: error.message} : p));
      throw error;
    }).finally(() => tasks.current.delete(token));
    tasks.current.set(token, job);
    void job.catch(() => undefined); // 失败由槽位展示；点击保存 / 重试时继续处理。
  };
  const retry = () => live.current.forEach(p => {
    if ('data' in p && !p.upload && p.token) upload(p.token, p.data);
  });
  const prepare = async () => {
    if (live.current.some(isPending)) throw new Error('照片还在处理中，请稍候');
    retry();
    await Promise.all(live.current.flatMap(p => p.token && tasks.current.has(p.token) ? [tasks.current.get(p.token)!] : []));
    if (!active.current) throw new Error('已取消保存');
    if (server && live.current.some(p => 'data' in p && !p.upload)) throw new Error('还有照片未上传，请重试上传');
    return live.current;
  };

  const addFiles = (files: File[]) => {
    const room = Math.max(MAX_PHOTOS - live.current.length, 0);
    if (files.length > room) notify(`一次最多再加 ${room} 张`, 'warn');
    const picks = files.slice(0, room);
    if (!picks.length) return;
    const tokens = picks.map(() => crypto.randomUUID());
    update(prev => [...prev, ...tokens.map(token => ({pending: true, token} as PhotoSlot))]);
    picks.forEach((file, k) => {
      const token = tokens[k];
      queue.current.add(
        file,
        data => {
          if (!active.current || !live.current.some(p => p.token === token)) return;
          update(prev => prev.map(p => p.token === token && 'pending' in p ? {data, token} : p));
          upload(token, data);
        },
        msg => update(prev => prev.map(p => p.token === token && 'pending' in p ? {error: msg, token} : p)),
      );
    });
  };

  const remove = (i: number) => update(prev => prev.filter((_, k) => k !== i));

  return {slots, addFiles, remove, prepare, retry, hasPending: slots.some(isPending),
    uploading: slots.filter(p => 'data' in p && p.transfer === 'uploading').length,
    failed: slots.filter(p => 'data' in p && p.transfer === 'failed').length,
    uploaded: slots.filter(p => 'data' in p && p.upload).length,
    newCount: slots.filter(p => 'data' in p || 'pending' in p).length};
}

export function PhotoThumbs({slots, recordId, small = false, onRemove}: {
  slots: PhotoSlot[]; recordId: string | null; small?: boolean; onRemove: (i: number) => void;
}) {
  if (!slots.length) return null;
  return (
    <div className={small ? 'batch-photos' : 'photo-thumbs'}>
      {slots.map((p, i) => {
        const close = <button type="button" onClick={() => onRemove(i)} aria-label="移除这张照片">×</button>;
        const cls = `photo-thumb${small ? ' small' : ''}${'pending' in p ? ' pending' : ''}${'error' in p ? ' failed' : ''}`;
        if ('pending' in p) {
          return <div key={i} className={cls}><span className="ph-wait"/><span className="ph-tag">处理中</span>{close}</div>;
        }
        if ('error' in p) {
          return <div key={i} className={cls}><span className="ph-tag err" title={p.error}>处理失败</span>{close}</div>;
        }
        const src = 'existing' in p ? `/api/photo/${recordId}/${p.existing}` : p.data;
        return <div key={i} className={cls}><img src={src} alt={`实物照片 ${i + 1}`} loading="lazy"/>
          {'data' in p && p.transfer ? <span className="ph-transfer" title={p.transferError}>
            {p.transfer === 'uploading' ? '上传中' : '未上传'}</span> : null}{close}</div>;
      })}
    </div>
  );
}
