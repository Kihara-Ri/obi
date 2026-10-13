import {useEffect, useRef, useState} from 'react';
import {detectDiscEllipse, rasterDisc, validDiscCalibration} from '@diedu/album-engine/disc-calibration';
import type {DiscCalibration, DiscEllipse} from '@diedu/album-engine/disc-calibration';
import type {TwinJob} from '../types';
import {api} from '../core/api';

type Role = 'disc' | 'disc2' | 'disc3' | 'disc4';
const LIMIT = (v:number, a:number, b:number)=>Math.max(a,Math.min(b,v));
const copyEllipse = (e:DiscEllipse):DiscEllipse=>({...e});
export function DiscCalibrationEditor({job, onSaved, onClose}: {
  job:TwinJob; onSaved():Promise<void>; onClose():void;
}) {
  const roles = (['disc','disc2','disc3','disc4'] as const).filter(role=>job.entity?.surfaces[role]?.asset);
  const [role,setRole]=useState<Role>(roles[0] ?? 'disc');
  const [source,setSource]=useState<ImageData|null>(null);
  const [size,setSize]=useState({width:1,height:1});
  const [cal,setCal]=useState<DiscCalibration|null>(null);
  const [automated,setAutomated]=useState<DiscCalibration|null>(null);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const output=useRef<HTMLCanvasElement>(null);
  const drag=useRef<'center'|'outer-x'|'outer-y'|'inner-center'|'inner-x'|'inner-y'|null>(null);
  const surface=job.entity?.surfaces[role];
  const url=surface ? '/api/twin-assets/'+job.id+'/'+surface.asset : '';
  const defaultEllipse=(w:number,h:number):DiscEllipse=>({
    cx:.5,cy:.5,rx:Math.min(.46,.46*h/w),ry:Math.min(.46,.46*w/h),angle:0,
  });
  useEffect(()=>{
    let active=true;setSource(null);setError('');
    const image=new Image();
    image.onload=()=>{
      if(!active)return;
      const scale=Math.min(1,1100/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx){setError('无法读取图像');return;}
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const data=ctx.getImageData(0,0,canvas.width,canvas.height);
      const found=detectDiscEllipse(data.data,data.width,data.height);
      setSource(data);setSize({width:data.width,height:data.height});setAutomated(found);
      setCal(surface?.discCalibration ? structuredClone(surface.discCalibration) :
        found ? structuredClone(found) : {outer:defaultEllipse(data.width,data.height),source:'manual'});
    };
    image.onerror=()=>{if(active)setError('无法加载原始盘面图片');};
    image.src=url;
    return()=>{active=false;image.onload=null;image.onerror=null;};
  },[url, surface?.discCalibration]);
  useEffect(()=>{
    if(!source||!cal||!output.current||!validDiscCalibration(cal))return;
    let disposed=false;
    const handle=window.setTimeout(()=>{
      const result=rasterDisc(source.data,source.width,source.height,cal,440);
      if(disposed||!result||!output.current)return;
      const canvas=output.current;canvas.width=result.width;canvas.height=result.height;
      canvas.getContext('2d')?.putImageData(new ImageData(result.data,result.width,result.height),0,0);
    },75);
    return()=>{disposed=true;window.clearTimeout(handle);};
  },[source,cal]);
  const adjust=(which:'outer'|'inner',field:keyof DiscEllipse,n:number)=>{
    if(!cal)return;
    const before=which==='outer'?cal.outer:cal.inner;
    if(!before)return;
    const next={...before,[field]:field==='angle'?LIMIT(n,-Math.PI,Math.PI):LIMIT(n,field==='cx'||field==='cy'?0:.025,1)};
    setCal({...cal,[which]:next,source:'manual',confidence:undefined});
  };
  const local=(event:React.PointerEvent<SVGSVGElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    return {x:LIMIT((event.clientX-rect.left)/rect.width,0,1),y:LIMIT((event.clientY-rect.top)/rect.height,0,1)};
  };
  const pointerMove=(event:React.PointerEvent<SVGSVGElement>)=>{
    if(!drag.current||!cal)return;
    const {x,y}=local(event);
    const inner=drag.current.startsWith('inner');
    const e=inner?cal.inner:cal.outer;
    if(!e)return;
    if(drag.current==='center'||drag.current==='inner-center'){
      setCal(prev=>prev?{...prev,[inner?'inner':'outer']:{...(inner?prev.inner!:prev.outer),cx:x,cy:y},source:'manual',confidence:undefined}:prev);
    }else{
      const dx=x-e.cx,dy=y-e.cy,c=Math.cos(e.angle),s=Math.sin(e.angle);
      const radius=drag.current.endsWith('x')?Math.abs(dx*c+dy*s):Math.abs(-dx*s+dy*c);
      adjust(inner?'inner':'outer',drag.current.endsWith('x')?'rx':'ry',radius);
    }
  };
  const mark=(e:DiscEllipse,color:string,scope:'outer'|'inner')=>{
    const c=Math.cos(e.angle),s=Math.sin(e.angle);
    const controls=[{k:scope==='outer'?'center':'inner-center',x:e.cx,y:e.cy},
      {k:scope==='outer'?'outer-x':'inner-x',x:e.cx+e.rx*c,y:e.cy+e.rx*s},
      {k:scope==='outer'?'outer-y':'inner-y',x:e.cx-e.ry*s,y:e.cy+e.ry*c}];
    return <g>
      <ellipse cx={e.cx*1000} cy={e.cy*1000} rx={e.rx*1000} ry={e.ry*1000}
        transform={'rotate('+(e.angle*180/Math.PI)+' '+(e.cx*1000)+' '+(e.cy*1000)+')'}
        fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke"/>
      {controls.map(point=><circle key={point.k} cx={point.x*1000} cy={point.y*1000} r="11"
        fill={color} stroke="#151515" strokeWidth="2" onPointerDown={event=>{
          event.preventDefault();event.stopPropagation();
          drag.current=point.k as typeof drag.current;
          event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
        }}/>)}
    </g>;
  };
  const save=async(reset=false)=>{
    if(!cal&&!reset)return;
    if(!reset&&!validDiscCalibration(cal!)){setError('椭圆超出原图或中心环尺寸不正确');return;}
    setSaving(true);setError('');
    try {
      await api('twins/disc-calibration',{id:job.id,role,calibration:reset?null:{...cal,source:'manual'}});
      await onSaved();onClose();
    } catch(err){setError(err instanceof Error?err.message:'保存失败');}
    finally{setSaving(false);}
  };
  const switchRole=(value:Role)=>{setRole(value);drag.current=null;};
  return <div className="disc-calibration-overlay" role="dialog" aria-modal="true" aria-label="盘面贴图校准"
    onClick={event=>event.stopPropagation()} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();onClose();}}}>
    <div className="disc-calibration-panel">
      <div className="disc-calibration-heading"><strong>盘面校准</strong><div className="disc-calibration-heading-actions">
        {cal?<button type="button" disabled={saving||!validDiscCalibration(cal)} onClick={()=>void save()}>{saving?'保存中…':'保存'}</button>:null}
        <button type="button" className="quiet" onClick={onClose}>关闭</button>
      </div></div>
      <p className="small-note">按住圆心或外圈控制点拖动。原图不变，校准结果仅用于数字实体显示。</p>
      {roles.length>1?<div className="disc-calibration-roles">{roles.map((r,i)=><button type="button" key={r}
        className={r===role?'selected':''} onClick={()=>switchRole(r)}>CD {i+1}</button>)}</div>:null}
      <div className="disc-calibration-workspace">
        <div className="disc-calibration-source" style={{aspectRatio:size.width+'/'+size.height}}>
          {url?<img src={url} alt="盘面原始来源"/>:null}
          {cal?<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" onPointerMove={pointerMove}
            onPointerUp={event=>{drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);}}
            onPointerCancel={()=>{drag.current=null;}} aria-label="拖动调整盘面椭圆">
            {mark(cal.outer,'#8ae8ff','outer')}{cal.inner?mark(cal.inner,'#ffcc80','inner'):null}
          </svg>:null}
        </div>
        <div className="disc-calibration-result">
          <canvas ref={output} aria-label="圆形盘面校正预览"/>
          <span>实时正视预览</span>
        </div>
      </div>
      {cal?<div className="disc-calibration-settings">
        <label>旋转角度 <input type="range" min="-180" max="180" value={Math.round(cal.outer.angle*180/Math.PI)}
          onChange={event=>adjust('outer','angle',Number(event.target.value)*Math.PI/180)}/></label>
        <label><input type="checkbox" checked={!!cal.inner} onChange={event=>setCal(prev=>!prev?prev:{
          ...prev,inner:event.target.checked?{
            ...copyEllipse(prev.outer),rx:prev.outer.rx*.22,ry:prev.outer.ry*.22}:undefined,source:'manual'})}/>
          校准中心环（可选）</label>
        <div className="disc-calibration-actions">
          <button type="button" className="quiet" disabled={!automated}
            onClick={()=>automated&&setCal(structuredClone(automated))}>自动拟合外圆</button>
          <button type="button" className="quiet" onClick={()=>setCal({
            outer:defaultEllipse(size.width,size.height),source:'manual'})}>重置控制点</button>
          {surface?.discCalibration?<button type="button" className="quiet" disabled={saving} onClick={()=>void save(true)}>撤销已保存校准</button>:null}
          <button type="button" disabled={saving||!validDiscCalibration(cal)} onClick={()=>void save()}>{saving?'保存中…':'保存盘面校准'}</button>
        </div>
      </div>:<p className="small-note">正在加载原始盘面图…</p>}
      {error?<p className="disc-calibration-error" role="alert">{error}</p>:null}
    </div>
  </div>;
}
