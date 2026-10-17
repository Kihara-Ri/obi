import {useMemo} from 'react';
import type {AlbumDocument, AssetResolver} from '@diedu/album-engine/schema';
import type {AlbumOrientationPermission} from '@diedu/album-engine/orientation';
import {useApp} from '../state/AppContext';
import {EngineMount} from './EngineMount';

/** Only the installed plugin loads model code, after the explicit 3D click. */
export function AlbumModel({entity, resolveAsset, modelBaseUrl, permission, onDismiss, onUnavailable}: {
  entity: AlbumDocument; resolveAsset: AssetResolver; modelBaseUrl?: string;
  permission: Promise<AlbumOrientationPermission>; onDismiss(): void; onUnavailable(): void;
}) {
  const plugin = useApp().albumEngine;
  const baseUrl = modelBaseUrl || plugin.status?.modelBaseUrl;
  const props = useMemo(() => ({entity, resolveAsset, models: {baseUrl, rigVersion: 1}, permission,
    layout: 'fill', onRequestClose: onDismiss, onUnavailable}), [entity, resolveAsset, baseUrl, permission, onDismiss, onUnavailable]);
  return baseUrl ? <EngineMount kind="viewer" props={props} onUnavailable={onUnavailable}/> : null;
}
