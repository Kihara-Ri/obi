import {useCallback, useMemo} from 'react';
import {CSSAlbumViewer} from '@diedu/album-engine';
import type {AlbumRecord} from '../types';
import type {AlbumOrientationPermission} from './useAlbumOrientation';
import {toAlbumEntity, resolveAlbumAsset} from '../core/album-entity';
import {useAlbumFallbackInput} from './useAlbumFallbackInput';

const models = Object.freeze({baseUrl:'/models/packaging/', rigVersion:1 as const});

/** The host owns resource authorization and lightbox navigation. */
export function CSSAlbumModel({record, permission, onDismiss}: {
  record: AlbumRecord; permission: Promise<AlbumOrientationPermission>; onDismiss(): void;
}) {
  const entity = useMemo(() => toAlbumEntity(record), [record]);
  const resolveAsset = useCallback((asset:string) => resolveAlbumAsset(record, asset), [record]);
  const fallbackInputEnabled = useAlbumFallbackInput();
  return <CSSAlbumViewer entity={entity} resolveAsset={resolveAsset} models={models} permission={permission} fallbackInputEnabled={fallbackInputEnabled} onRequestClose={onDismiss}/>;
}
