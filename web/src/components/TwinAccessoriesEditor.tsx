import {useMemo} from 'react';
import type {ComponentProps} from 'react';
import type {TwinAccessoriesEditor as EngineEditor} from '@diedu/album-engine/editor';
import {EngineMount} from './EngineMount';
import {useApp} from '../state/AppContext';
import type {GenerationCandidate} from '@diedu/album-engine/editor';
import type {AlbumRecord, TwinJob} from '../types';
import {api} from '../core/api';

/** Source interpretation, selection and editor state belong to the engine. */
export function TwinAccessoriesEditor({record,job,onSaved,onClose}: {
  record:AlbumRecord;job:TwinJob;onSaved():Promise<void>;onClose():void;
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
  return {photos, candidate, components: job.entity?.components||[], resolveSource: source=>urls.get(source)||'', onClose, onSubmit: async components=>{
      await api('twins/accessories',{id:job.id,components});await onSaved();
    }};
  }, [runtime, job, record, onSaved, onClose]);
  return props ? <EngineMount kind="accessories-editor" props={props}/> : null;
}
