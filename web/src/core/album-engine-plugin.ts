import type {inspectAlbum} from '@diedu/album-engine/capabilities';
import type {requestAlbumOrientationPermission} from '@diedu/album-engine/orientation';
import type {editionMaterialSources} from '@diedu/album-engine/editor';
import type {spineCalibrationFit, spineCalibrationFitForEntity} from '@diedu/album-engine/calibration';

export interface AlbumEngineStatus {
  installed: boolean; available: boolean; version: string | null; availableVersion: string | null;
  revision: number; entryUrl: string | null; styleUrl: string | null; modelBaseUrl: string | null;
  busy: boolean; error: string | null;
}
export type EngineMountKind = 'viewer' | 'guided-editor' | 'accessories-editor' | 'disc-calibration-editor';
export interface AlbumEngineRuntime {
  manifest: {id: string; pluginProtocol: number; version: string};
  inspectAlbum: typeof inspectAlbum;
  requestAlbumOrientationPermission: typeof requestAlbumOrientationPermission;
  editionMaterialSources: typeof editionMaterialSources;
  spineCalibrationFit: typeof spineCalibrationFit;
  spineCalibrationFitForEntity: typeof spineCalibrationFitForEntity;
  mount(kind: EngineMountKind, element: HTMLElement, props: unknown): Promise<() => void>;
}

/** Only the server's active same-origin installation may supply executable code. */
export async function loadAlbumEngine(status: AlbumEngineStatus): Promise<AlbumEngineRuntime> {
  if (!status.installed || !status.entryUrl) throw new Error('请先安装 Album Engine');
  const entry = new URL(status.entryUrl, location.origin);
  if (entry.origin !== location.origin || !entry.pathname.startsWith('/api/plugins/album-engine/assets/'))
    throw new Error('引擎入口无效');
  const runtime = await import(/* @vite-ignore */ entry.href) as AlbumEngineRuntime;
  if (runtime.manifest?.id !== 'album-engine' || runtime.manifest.pluginProtocol !== 1
    || runtime.manifest.version !== status.version || typeof runtime.mount !== 'function'
    || !['inspectAlbum', 'requestAlbumOrientationPermission', 'editionMaterialSources', 'spineCalibrationFit',
      'spineCalibrationFitForEntity'].every(name => typeof runtime[name as keyof AlbumEngineRuntime] === 'function')) throw new Error('引擎版本不兼容');
  return runtime;
}
