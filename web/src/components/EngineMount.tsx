// EngineMount：把已安装的 Album Engine 插件里的某个视图（kind）挂到一个容器上；插件自带 React 根，
// 宿主只负责挂载 / 卸载与「引擎暂不可用」的兜底提示。未安装引擎时不渲染任何内容（2D 封面照常）。
import {useLayoutEffect, useRef, useState} from 'react';
import {useApp} from '../state/AppContext';
import {mountAlbumEngine} from '../core/album-engine-mount';
import type {EngineMountKind} from '../core/album-engine-plugin';

/** The plugin creates its own React root. Dispose even a mount resolving after removal. */
export function EngineMount({kind, props, onUnavailable}: {
  kind: EngineMountKind; props: unknown; onUnavailable?(): void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const {runtime} = useApp().albumEngine;
  const failed = useRef(onUnavailable); failed.current = onUnavailable;
  useLayoutEffect(() => {
    setError(false);
    const target = element.current;
    if (!runtime || !target) return;
    return mountAlbumEngine(runtime, kind, target, props, () => {setError(true); failed.current?.();});
  }, [runtime, kind, props]);
  return runtime ? <><div ref={element} className={'album-engine-mount album-engine-mount--' + kind}/>
    {error ? <p className="small-note" role="alert">引擎暂不可用，请在设置中重试。</p> : null}</> : null;
}
