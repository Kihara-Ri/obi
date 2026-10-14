import {useMemo, useState} from 'react';
import type {AlbumRecord, TwinJob, TwinReleaseCandidate} from '../types';
import {api} from '../core/api';

type PartKind = 'obi' | 'booklet' | 'inner-sleeve';
type Packaging = 'card-sleeve'|'jewel'|'gatefold'|'digipak'|'digibook'|'rigid-box';
const packages: {value: Packaging; label: string}[] = [
  {value:'card-sleeve',label:'Card Sleeve / 纸封套'},
  {value:'jewel',label:'Jewel Case / 塑料盒'},
  {value:'gatefold',label:'Gatefold / 对折纸封'},
  {value:'digipak',label:'Digipak'},
  {value:'digibook',label:'Digibook'},
  {value:'rigid-box',label:'Rigid Box'},
];
const labels: Record<string,string> = {front:'正面',back:'背面',insideLeft:'左内面',insideRight:'右内面',
  disc:'CD 1',disc2:'CD 2',disc3:'CD 3',disc4:'CD 4',outer:'外套',spine:'书脊'};
const parts: {kind: PartKind;label:string}[] = [
  {kind:'obi',label:'独立侧标 OBI'},
  {kind:'booklet',label:'可取出的歌词册'},
  {kind:'inner-sleeve',label:'纸质内袋'},
];

function recognizedPackage(raw: string | null | undefined): Packaging|'' {
  const t=(raw||'').toLowerCase();
  if(t.includes('gatefold'))return 'gatefold';
  if(t.includes('digipak'))return 'digipak';
  if(t.includes('digibook'))return 'digibook';
  if(t.includes('jewel'))return 'jewel';
  if(t.includes('cardboard')||t.includes('sleeve'))return 'card-sleeve';
  return '';
}
function candidatePhotos(candidate: TwinReleaseCandidate) {
  const caa=(candidate.artwork||[]).map(photo=>({sourceId:'caa:'+photo.id,types:photo.types,label:photo.types.join(' / ')||'CAA'}));
  const discogs=(candidate.editionReferences||[]).filter(ref=>ref.status==='verified')
    .flatMap(ref=>(ref.images||[]).map((image,i)=>({sourceId:image.sourceId,types:[] as string[],label:'Discogs #'+i})));
  const compatible=(candidate.compatibleArtwork||[]).flatMap(ref=>ref.images.map(image=>({
    sourceId:image.sourceId,types:image.types,label:'同封装版次 / '+image.types.join(', ')})));
  return [...caa,...discogs,...compatible];
}

export function GuidedTwinEditor({job,record,onSaved,disabled=false}: {
  job:TwinJob;record:AlbumRecord; onSaved():Promise<void>;disabled?:boolean;
}) {
  const candidate=job.candidates?.find(item=>item.id===job.releaseId);
  const choices=useMemo(()=>{
    const original=Array.from({length:record.photoCount},(_,i)=>({
      sourceId:'photo:'+i,types:[] as string[],label:'本人实物照片 #'+(i+1),
    }));
    return [...original,...(candidate?candidatePhotos(candidate):[])];
  },[candidate,record.photoCount]);
  const [kind,setKind]=useState<Packaging|''>(()=>recognizedPackage(candidate?.packaging));
  const [miniLP,setMiniLP]=useState(false);
  const [confirmedMismatch,setConfirmedMismatch]=useState(false);
  const [faces,setFaces]=useState<Record<string,string>>(()=>{
    const result:Record<string,string>={};
    for(const [role,i] of Object.entries(record.packaging?.photos||{})) result[role]='photo:'+i;
    for(const face of ['front','back','disc']){
      const type=face==='disc'?'medium':face;
      const choice=choices.find(item=>item.types.some(t=>t.toLowerCase()===type));
      if(choice)result[face]=choice.sourceId;
    }
    return result;
  });
  const [accessories,setAccessories]=useState<Partial<Record<PartKind,string>>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  if(!candidate)return <p className="small-note">等待确认发行版图集数据。</p>;
  const count=candidate.discCount||1;
  const roles=['front','back',...((['jewel','gatefold','digipak','digibook'].includes(kind))?['insideLeft']:[]),
    ...((['gatefold','digipak','digibook'].includes(kind))?['insideRight']:[]),
    ...Array.from({length:count},(_,i)=>i===0?'disc':'disc'+(i+1))];
  const supported=new Set(choices.map(c=>c.sourceId));
  const fromRelease=recognizedPackage(candidate.packaging);
  const mismatch=!!kind&&!!fromRelease&&fromRelease!==kind;
  const valid=!!kind&&(!mismatch||confirmedMismatch)&&roles.every(role=>supported.has(faces[role]))&&
    Object.values(accessories).every(item=>!item||supported.has(item));
  const submit=async()=>{
    if(!valid||busy)return;
    setBusy(true);setError('');
    try {
      await api('twins/guided',{
        id:job.id,
        selection:{confirmedPackagingOverride:mismatch&&confirmedMismatch,packaging:{structure:kind,discs:count,miniLP,holder:kind==='jewel'?'tray':'pocket'},
          surfaces:Object.fromEntries(roles.map(role=>[role,faces[role]])),
          components:parts.filter(p=>accessories[p.kind]).map(p=>({kind:p.kind,sourceId:accessories[p.kind]}))},
      });
      await onSaved();
    }catch(exc){setError(exc instanceof Error?exc.message:'图源确认失败');}
    finally{setBusy(false);}
  };
  const options=(<><option value="">请确认图源</option>{choices.map(choice=><option key={choice.sourceId} value={choice.sourceId}>
    {choice.label} · {choice.sourceId}
  </option>)}</>);
  return <section className="twin-guided" aria-label="人工确认数字实体素材">
    <p className="small-note">无需视觉模型。只有已验证的同版或同封装图片可选择；Discogs 照片没有准确的面类型标签，请对照缩略图逐一确认。</p>
    <div className="twin-guided-packaging">
      <label>实物封装
        <select value={kind} onChange={event=>setKind(event.target.value as Packaging|'')}>
          <option value="">选择封装类型</option>{packages.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>
      <label><input type="checkbox" checked={miniLP} disabled={kind!=='card-sleeve'&&kind!=='gatefold'}
        onChange={event=>setMiniLP(event.target.checked)}/> Mini LP 尺寸/形式</label>
    </div>
    {mismatch?<label><input type="checkbox" checked={confirmedMismatch}
      onChange={event=>setConfirmedMismatch(event.target.checked)}/>
      已核对实物，确认与 MusicBrainz 所列封装类型不同</label>:null}
    <div className="twin-guided-gallery">
      {choices.map((choice,i)=><figure key={choice.sourceId}>
        <img src={choice.sourceId.startsWith('photo:') ?
          '/api/photo/'+record.id+'/'+choice.sourceId.slice(6) :
          '/api/twin-source-preview/'+job.id+'/'+(i-record.photoCount)+'?source='+encodeURIComponent(choice.sourceId)}
          loading="lazy" alt={choice.label}/>
        <figcaption>{i+1}. {choice.label}</figcaption>
      </figure>)}
    </div>
    <div className="twin-guided-mapping">
      {roles.map(role=><label key={role}>{labels[role]||role}
        <select value={faces[role]||''} onChange={event=>setFaces(prev=>({...prev,[role]:event.target.value}))}>
          {options}
        </select></label>)}
    </div>
    <p className="small-note">可选独立 3D 附件：仅在确实有照片时指定，歌词册、侧标和内袋不会被伪装成封套内页。</p>
    <div className="twin-guided-mapping">
      {parts.map(part=><label key={part.kind}>{part.label}
        <select value={accessories[part.kind]||''} onChange={event=>setAccessories(prev=>({...prev,[part.kind]:event.target.value}))}>
          <option value="">没有这个附件 / 暂不建模</option>
          {choices.map(choice=><option key={choice.sourceId} value={choice.sourceId}>{choice.label} · {choice.sourceId}</option>)}
        </select></label>)}
    </div>
    {error?<p className="twin-error" role="alert">{error}</p>:null}
    <button type="button" className="primary" disabled={!valid||busy||disabled} onClick={()=>void submit()}>
      {busy?'正在确认…':'确认图片与包装，生成 3D 实体'}
    </button>
  </section>;
}
