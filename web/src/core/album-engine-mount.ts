import type {AlbumEngineRuntime, EngineMountKind} from './album-engine-plugin';

/** A mount may finish after navigation, uninstall, or another mount replaces it. */
export function mountAlbumEngine(runtime: AlbumEngineRuntime, kind: EngineMountKind,
  target: HTMLElement, props: unknown, onUnavailable: () => void): () => void {
  let alive = true; let dispose: (() => void) | undefined;
  void Promise.resolve().then(() => alive ? runtime.mount(kind, target, props) : undefined).then(cleanup => {
    if (!cleanup) return;
    if (alive) dispose = cleanup; else cleanup();
  }).catch(() => {if (alive) onUnavailable();});
  return () => {
    if (!alive) return;
    alive = false; dispose?.(); dispose = undefined;
  };
}
