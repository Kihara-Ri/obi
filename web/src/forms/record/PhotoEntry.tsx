// 实物照片入口：拖入或多选添加，缩略图可移除（同步重映射包装图所用的照片序号）。
import {useRef} from 'react';
import {CamIco} from '../../components/icons';
import {remapPackagingPhotos} from '../../core/album-packaging';
import {MAX_PHOTOS} from '../../core/photos';
import {PhotoThumbs, type usePhotoSlots} from '../PhotoSlots';
import type {FormCtx} from './context';

export function PhotoEntry({ctx, photos, recordId}: {
  ctx: FormCtx; photos: ReturnType<typeof usePhotoSlots>; recordId: string | null;
}) {
  const {v, set, dirty} = ctx;
  const fileInput = useRef<HTMLInputElement>(null);
  const add = (files: File[]) => {if (files.length) {photos.addFiles(files); dirty();}};
  return (
    <section className="record-photo-entry" onDragOver={e => e.preventDefault()}
      onDrop={e => {e.preventDefault(); add([...e.dataTransfer.files]);}}>
      <div className="record-photo-head"><strong>实物照片</strong><small>最多 {MAX_PHOTOS} 张</small></div>
      <PhotoThumbs slots={photos.slots} recordId={recordId} onRemove={i => {
        set({packaging: remapPackagingPhotos(v.packaging, photos.slots.map((_, k) => k).filter(k => k !== i))});
        photos.remove(i); dirty();
      }}/>
      <div className="photo-actions">
        <button type="button" onClick={() => fileInput.current?.click()}>{CamIco}<span>添加照片</span></button>
      </div>
      <input ref={fileInput} type="file" accept="image/*,.heic,.heif" multiple hidden
        onChange={e => {const files = [...(e.target.files ?? [])]; e.target.value = ''; add(files);}}/>
    </section>
  );
}
