// 按页拆包：每个页面单独成一个 chunk，主包只留外壳与公共组件。
// 声明时就开始下载（与首个 /api/state 并行）；App 等 pagesReady() 到齐才渲染首屏，
// 之后切页都是同步渲染——页面切换动画抓快照、量高度时，新页面已经完整在 DOM 里，与不拆包时一致。
// 不用 React.lazy / Suspense：那样首次进入某页会先渲染一帧空白。
import {createElement} from 'react';
import type {ComponentType} from 'react';

const pending: Promise<unknown>[] = [];

export function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> {
  let loaded: ComponentType<P> | null = null;
  pending.push(load().then(component => { loaded = component; }));
  return function Page(props: P) {
    return loaded ? createElement(loaded, props) : null;
  };
}

/** 所有页面 chunk 到齐；任何一个加载失败就 reject，由调用方显示「重新连接」。 */
export const pagesReady = () => Promise.all(pending);
