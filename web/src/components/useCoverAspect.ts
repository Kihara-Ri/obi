// 取得封面的宽高比：缩略图已加载过则同步返回（灯箱打开动画的终点据此一次到位），
// 否则预载一次再更新；没有封面或载入失败时为 1。
import {useEffect, useState} from 'react';
import {knownCoverAspect, rememberCoverAspect} from '../core/cover-aspect';

export function useCoverAspect(src: string | undefined): number {
  const [aspect, setAspect] = useState(() => knownCoverAspect(src) ?? 1);
  useEffect(() => {
    if (!src) { setAspect(1); return; }
    const known = knownCoverAspect(src);
    if (known) { setAspect(known); return; }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      rememberCoverAspect(src, image.naturalWidth, image.naturalHeight);
      if (!cancelled) setAspect(knownCoverAspect(src) ?? 1);
    };
    image.src = src;
    return () => { cancelled = true; image.onload = null; };
  }, [src]);
  return aspect;
}
