// 载入专辑喜好 / 收藏时间（album-favorites）；失败时提示一次。
import {useEffect, useState} from 'react';
import {api} from '../core/api';
import type {AlbumCatalog} from '../types';
import type {AppCtx} from '../state/AppContext';

export function useAlbumLikes(app: AppCtx) {
  const [likes, setLikes] = useState<AlbumCatalog>({albums: {}, recordAlbumIds: {}, favorites: {}, collectedAt: {}});
  useEffect(() => {
    let active = true;
    void api<AlbumCatalog>('album-favorites').then(data => {
      if (active) setLikes(data);
    }).catch(() => app.toast('专辑喜好暂时无法载入', 'warn'));
    return () => {active = false;};
  }, []);
  return likes;
}
