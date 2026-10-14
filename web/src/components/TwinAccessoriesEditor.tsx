import {useMemo, useState} from 'react';
import type {AlbumRecord, TwinJob, TwinReleaseCandidate} from '../types';
import {api} from '../core/api';

type Kind = 'obi' | 'booklet' | 'inner-sleeve';
const kinds: {value:Kind;label:string}[] = [
  {value:'obi',label:'侧标 OBI'},
  {value:'booklet',label:'歌词册'},
  {value:'inner-sleeve',label:'内袋'},
];

function candidates(item?:TwinReleaseCandidate) {
  if (!item) return [];
  return [
    ...(item.artwork||[]).map(image=>({id:'caa:'+image.id,label:'CAA · '+image.types.join(', ')})),
    ...(item.editionReferences||[]).filter(ref=>ref.status==='verified')
      .flatMap(ref=>(ref.images||[]).map((image,index)=>({id:image.sourceId,label:'Discogs #'+(index+1)}))),
    ...(item.compatibleArtwork||[]).flatMap(ref=>ref.images.map(image=>({
      id:image.sourceId,label:'同封装版 · '+image.types.join(', ')}))),
  ];
}

function sourceOf(asset:string, ids:string[]) {
  const match=/^discogs-(d+)-(d+).(?:jpg|png|webp)$/.exec(asset);
  if(match) return ids.find(id=>id==='discogs:'+match[1]+':'+match[2]) || '';
  const caa=/^caa-(d+).(?:jpg|png|webp)$/.exec(asset);
  if(caa) return ids.find(id=>id.endsWith(':'+caa[1])||id==='caa:'+caa[1]) || '';
  const photo=/^photo-(d+).(?:jpg|png|webp)$/.exec(asset);
  if(photo) return ids.find(id=>id==='photo:'+photo[1]) || '';
  return '';
}

export function TwinAccessoriesEditor({record,job,onSaved,onClose}: {
  record:AlbumRecord;job:TwinJob;onSaved():Promise<void>;onClose():void;
}) {
  const candidate=job.candidates?.find(c=>c.id===job.releaseId);
  const images=useMemo(()=>[
    ...Array.from({length:record.photoCount},(_,i)=>({id:'photo:'+i,label:'实物照片 '+(i+1)})),
    ...candidates(candidate),
  ],[candidate,record.photoCount]);
  const ids=images.map(item=>item.id);
  const [selection,setSelection]=useState<Partial<Record<Kind,string>>>(()=>{
    const mapped:Partial<Record<Kind,string>>={};
    for(const part of job.entity?.components||[]) {
      mapped[part.kind]=sourceOf(part.asset,ids);
    }
    return mapped;
  });
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  if(!images.length) return <p className="small-note">当前实体没有可复用的已核验图集或实物照片，暂不能增删附件。请先补充实物照片。</p>;
  const save=async()=>{
    if(saving)return;
    setSaving(true);setError('');
    try {
      await api('twins/accessories',{id:job.id,
        components:kinds.filter(k=>selection[k.value]).map(k=>({kind:k.value,sourceId:selection[k.value]}))});
      await onSaved();onClose();
    }catch(err){setError(err instanceof Error?err.message:'附件保存失败');}
    finally{setSaving(false);}
  };
  return <section className="twin-guided" aria-label="更新独立包装附件">
    <p className="small-note">补充或移除附件，不重新生成封套和 CD。只允许使用已核验的发行版原图和当前实物照片；未选择的附件不会创建模型。</p>
    <div className="twin-guided-gallery">
      {images.map((item,i)=><figure key={item.id}>
        <img alt={item.label} loading="lazy"
          src={item.id.startsWith('photo:')?
            '/api/photo/'+record.id+'/'+item.id.slice(6):
            '/api/twin-source-preview/'+job.id+'/'+(i-record.photoCount)+'?source='+encodeURIComponent(item.id)}/>
        <figcaption>{item.label}</figcaption>
      </figure>)}
    </div>
    <div className="twin-guided-mapping">
      {kinds.map(kind=><label key={kind.value}>{kind.label}
        <select value={selection[kind.value]||''} onChange={e=>setSelection(old=>({...old,[kind.value]:e.target.value}))}>
          <option value="">无附件 / 移除</option>
          {images.map(image=><option key={image.id} value={image.id}>{image.label} · {image.id}</option>)}
        </select>
      </label>)}
    </div>
    {error?<p role="alert" className="twin-error">{error}</p>:null}
    <div className="twin-generate-actions">
      <button type="button" className="primary" disabled={saving} onClick={()=>void save()}>{saving?'保存中…':'保存附件'}</button>
      <button type="button" className="quiet" disabled={saving} onClick={onClose}>取消</button>
    </div>
  </section>;
}
