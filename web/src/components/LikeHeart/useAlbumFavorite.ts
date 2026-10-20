// 「我喜欢」是专辑级偏好：与副本保存载荷分离，点一下立即保存（乐观更新，失败回滚）。
import {useEffect, useRef, useState} from 'react';
import {api} from '../../core/api';

type Favorites = {favorites: Record<string, boolean>};

export function useAlbumFavorite(id: string | undefined, onError: (message: string) => void) {
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const fail = useRef(onError);
  fail.current = onError;
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    void api<Favorites>('album-favorites')
      .then(data => {if (alive) setLiked(Boolean(data.favorites[id]));})
      .catch(e => {if (alive) fail.current(e instanceof Error ? e.message : String(e));})
      .finally(() => {if (alive) setLoading(false);});
    return () => {alive = false;};
  }, [id]);
  const toggle = async () => {
    if (!id || saving || loading) return;
    const next = !liked;
    setLiked(next); setSaving(true);
    try {
      const data = await api<Favorites>('album-favorites', {recordId: id, liked: next});
      setLiked(Boolean(data.favorites[id]));
    } catch (e) {
      setLiked(!next);
      fail.current(e instanceof Error ? e.message : String(e));
    } finally {setSaving(false);}
  };
  return {liked, loading, saving, toggle};
}
