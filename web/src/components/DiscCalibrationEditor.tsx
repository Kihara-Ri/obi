import {DiscCalibrationEditor as EngineEditor} from '@diedu/album-engine/editor';
import type {TwinJob} from '../types';
import {api} from '../core/api';

/** The engine owns editor UI and rasterization; the host authorizes persistence. */
export function DiscCalibrationEditor({job, onSaved, onClose}: {
  job: TwinJob; onSaved(): Promise<void>; onClose(): void;
}) {
  if (!job.entity) return null;
  return <EngineEditor surfaces={job.entity.surfaces}
    resolveAsset={asset => '/api/twin-assets/' + job.id + '/' + asset} onClose={onClose}
    onSave={async (role, calibration) => {
      await api('twins/disc-calibration', {id: job.id, role, calibration});
      await onSaved();
    }}/>;
}
