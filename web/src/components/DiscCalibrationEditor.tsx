import {useMemo} from 'react';
import type {ComponentProps} from 'react';
import type {DiscCalibrationEditor as EngineEditor} from '@diedu/album-engine/editor';
import type {TwinJob} from '../types';
import {api} from '../core/api';
import {EngineMount} from './EngineMount';

/** The engine owns editor UI and rasterization; the host authorizes persistence. */
export function DiscCalibrationEditor({job, onSaved, onClose}: {
  job: TwinJob; onSaved(): Promise<void>; onClose(): void;
}) {
  const props = useMemo<ComponentProps<typeof EngineEditor> | null>(() => job.entity ? ({
    surfaces: job.entity.surfaces, resolveAsset: asset => '/api/twin-assets/' + job.id + '/' + asset, onClose,
    onSave: async (role, calibration) => {
      await api('twins/disc-calibration', {id: job.id, role, calibration}); await onSaved();
    },
  }) : null, [job, onSaved, onClose]);
  return props ? <EngineMount kind="disc-calibration-editor" props={props}/> : null;
}
