// PageVeil：库存 ↔ 展示的转场幕布。先合上（Splash 转场版），后台把封面预加载完，再打开，
// 打开后直接是完整画面。预加载有超时兜底；Splash 退场结束后调用 onDone 卸载自己。
import {useEffect, useState} from 'react';
import {Splash} from '../ui';
import {preloadCovers} from '../../core/preload-covers';

export function PageVeil({covers, onDone}: {covers: string[]; onDone: () => void}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    preloadCovers(covers).then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
    // 只在挂载时按当时的封面清单预加载一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Splash transit ready={ready} onDone={onDone}/>;
}
