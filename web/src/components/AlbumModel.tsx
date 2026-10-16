import {AlbumViewer} from '@diedu/album-engine';
import type {AlbumDocument, AssetResolver} from '@diedu/album-engine/schema';
import type {AlbumOrientationPermission} from '@diedu/album-engine/orientation';

const models = Object.freeze({baseUrl: '/models/packaging/', rigVersion: 1 as const});

/** Loaded only after the explicit 3D click; no ledger-to-model reconstruction. */
export function AlbumModel({entity, resolveAsset, permission, onDismiss, onUnavailable}: {
  entity: AlbumDocument; resolveAsset: AssetResolver; permission: Promise<AlbumOrientationPermission>;
  onDismiss(): void; onUnavailable(): void;
}) {
  return <AlbumViewer entity={entity} resolveAsset={resolveAsset} models={models} permission={permission}
    layout="fill" onRequestClose={onDismiss} onUnavailable={onUnavailable}/>;
}
