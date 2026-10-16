import {GuidedTwinEditor as EngineGuidedTwinEditor, editionMaterialSources} from '@diedu/album-engine/editor';
import type {GenerationCandidate} from '@diedu/album-engine/editor';
import type {AlbumRecord, TwinJob} from '../types';
import {api} from '../core/api';

/** The host only authorizes copy/task assets and persists engine selections. */
export function GuidedTwinEditor({job,record,onSaved,disabled=false}: {
  job:TwinJob;record:AlbumRecord;onSaved():Promise<void>;disabled?:boolean;
}) {
  const release=job.candidates?.find(item=>item.id===job.releaseId);
  const candidate:GenerationCandidate|null=release?{packaging:release.packaging,discCount:release.discCount,
    artwork:release.artwork,editionReferences:release.editionReferences,compatibleArtwork:release.compatibleArtwork}:null;
  const photos=Array.from({length:record.photoCount},(_,index)=>({sourceId:'photo:'+index}));
  const urls=new Map(photos.map((photo,index)=>[photo.sourceId,'/api/photo/'+record.id+'/'+index]));
  editionMaterialSources(candidate).forEach((source,index)=>urls.set(source.sourceId,
    '/api/twin-source-preview/'+job.id+'/'+index+'?source='+encodeURIComponent(source.sourceId)));
  const initialSurfaces=Object.fromEntries(Object.entries(record.packaging?.photos||{}).map(([role,index])=>[role,'photo:'+index]));
  return <EngineGuidedTwinEditor candidate={candidate} photos={photos} initialSurfaces={initialSurfaces}
    resolveSource={source=>urls.get(source)||''} disabled={disabled} onSubmit={async selection=>{
      await api('twins/guided',{id:job.id,selection});await onSaved();
    }}/>;
}
