// 本副本照片预取由缩略图和保存按钮共用；固定照片版本，失败可重试。
import {useEffect, useState} from 'react';
import {fetchPhotoFiles, photoLabel} from '../../core/download';

export function usePhotoFiles(id: string, count: number, revision: number, artist: string, title: string) {
  const [files, setFiles] = useState<File[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setFiles(count ? null : []); setError('');
    if (count) void fetchPhotoFiles(id, count, photoLabel(artist, title), revision).then(value => {
      if (alive) setFiles(value);
    }).catch(e => {if (alive) {setFiles([]); setError(e instanceof Error ? e.message : '照片读取失败');}});
    return () => {alive = false;};
  }, [id, count, revision, artist, title, attempt]);
  return {files, error, retry: () => setAttempt(value => value + 1)};
}
