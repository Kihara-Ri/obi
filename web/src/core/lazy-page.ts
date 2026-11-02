// 按页拆包：每个页面单独成一个 chunk，主包只留外壳与公共组件。
// 首屏只等当前页的 chunk（与首个 /api/state 并行），首屏出来后再在后台预取其余页面（preloadPages）。
// 切页时 App 先确认目标页已到齐，没到齐就停在当前页等它——页面切换动画抓快照、量高度时，
// 新页面已经完整在 DOM 里，与不拆包时一致。
// 不用 React.lazy / Suspense：那样首次进入某页会先渲染一帧空白。
import {createElement, useSyncExternalStore} from 'react';
import type {ComponentType} from 'react';

export type LazyPage<P extends object> = ComponentType<P> & {
  /** 开始（或复用）下载；失败后下次调用会重新下载 */
  load(): Promise<unknown>;
  readonly loaded: boolean;
};

const pages: LazyPage<never>[] = [];
const listeners = new Set<() => void>();
let arrived = 0;   // 已到齐的页面数：变化时让订阅者重渲染

export function lazyPage<P extends object>(importer: () => Promise<ComponentType<P>>): LazyPage<P> {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<unknown> | null = null;
  const Page = function Page(props: P) {
    return loaded ? createElement(loaded, props) : null;
  } as LazyPage<P>;
  Page.load = () => pending ??= importer().then(component => {
    loaded = component;
    arrived++;
    listeners.forEach(listener => listener());
  }, error => { pending = null; throw error; });
  Object.defineProperty(Page, 'loaded', {get: () => loaded !== null});
  pages.push(Page as LazyPage<never>);
  return Page;
}

/** 首屏之后在后台下载其余页面；任何一个失败就 reject（切到该页时会再试一次） */
export const preloadPages = () => Promise.all(pages.map(page => page.load()));

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
/** 有页面 chunk 到齐时让调用的组件重渲染，配合 page.loaded 判断能否切过去 */
export const usePagesArrived = () => useSyncExternalStore(subscribe, () => arrived);
