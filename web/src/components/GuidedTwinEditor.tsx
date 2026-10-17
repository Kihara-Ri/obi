import {useMemo} from 'react';
import type {ComponentProps} from 'react';
import type {GuidedTwinEditor as EngineEditor} from '@diedu/album-engine/editor';
import {EngineMount} from './EngineMount';
import {useApp} from '../state/AppContext';
import type {GenerationCandidate} from '@diedu/album-engine/editor';
import type {AlbumRecord, TwinJob} from '../types';
import {api} from '../core/api';

/** The host only authorizes copy/task assets and persists engine selections. */
export function GuidedTwinEditor({job,record,onSaved,disabled=false}: {
  job:TwinJob;record:AlbumRecord;onSaved():Promise<void>;disabled?:boolean;
}) {
  const {runtime} = useApp().albumEngine;
  const props = useMemo<ComponentProps<typeof EngineEditor> | null>(() => {
  if (!runtime) return null;
  const release=job.candidates?.find(item=>item.id===job.releaseId);
  const candidate:GenerationCandidate|null=release?{packaging:release.packaging,discCount:release.discCount,
    artwork:release.artwork,editionReferences:release.editionReferences,compatibleArtwork:release.compatibleArtwork}:null;
  const photos=Array.from({length:record.photoCount},(_,index)=>({sourceId:'photo:'+index}));
  const urls=new Map(photos.map((photo,index)=>[photo.sourceId,'/api/photo/'+record.id+'/'+index]));
  runtime.editionMaterialSources(candidate).forEach((source,index)=>urls.set(source.sourceId,
    '/api/twin-source-preview/'+job.id+'/'+index+'?source='+encodeURIComponent(source.sourceId)));
  const initialSurfaces=Object.fromEntries(Object.entries(record.packaging?.photos||{}).map(([role,index])=>[role,'photo:'+index]));
  return {candidate, photos, initialSurfaces, resolveSource: source=>urls.get(source)||'', disabled, onSubmit: async selection=>{
      await api('twins/guided',{id:job.id,selection});await onSaved();
    }};
  }, [runtime, job, record, onSaved, disabled]);
  return props ? <EngineMount kind="guided-editor" props={props}/> : null;
}
