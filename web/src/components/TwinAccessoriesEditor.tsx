import {TwinAccessoriesEditor as EngineAccessoriesEditor, editionMaterialSources} from '@diedu/album-engine/editor';
import type {GenerationCandidate} from '@diedu/album-engine/editor';
import type {AlbumRecord, TwinJob} from '../types';
import {api} from '../core/api';

/** Source interpretation, selection and editor state belong to the engine. */
export function TwinAccessoriesEditor({record,job,onSaved,onClose}: {
  record:AlbumRecord;job:TwinJob;onSaved():Promise<void>;onClose():void;
}) {
  const release=job.candidates?.find(item=>item.id===job.releaseId);
  const candidate:GenerationCandidate|null=release?{packaging:release.packaging,discCount:release.discCount,
    artwork:release.artwork,editionReferences:release.editionReferences,compatibleArtwork:release.compatibleArtwork}:null;
  const photos=Array.from({length:record.photoCount},(_,index)=>({sourceId:'photo:'+index}));
  const urls=new Map(photos.map((photo,index)=>[photo.sourceId,'/api/photo/'+record.id+'/'+index]));
  editionMaterialSources(candidate).forEach((source,index)=>urls.set(source.sourceId,
    '/api/twin-source-preview/'+job.id+'/'+index+'?source='+encodeURIComponent(source.sourceId)));
  return <EngineAccessoriesEditor photos={photos} candidate={candidate} components={job.entity?.components||[]}
    resolveSource={source=>urls.get(source)||''} onClose={onClose} onSubmit={async components=>{
      await api('twins/accessories',{id:job.id,components});await onSaved();
    }}/>;
}
