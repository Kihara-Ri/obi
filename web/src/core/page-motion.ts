// 手机页面的空间模型：底栏标签的实际顺序（MobileNav 与切页动画共用这一份），以及两页之间是什么关系。
// 关系决定动画：底栏之间横向切换（方向按图标左右位置）、「更多」里进一层是推入、退一层是弹出。
import type {ModuleFlags} from '../types';
import {pageEnabled} from './modules';
import {BACK_TARGET} from './page-back';

export const MOBILE_TABS = [
  {hash: 'domestic', label: '库存', count: 'inventory'},
  {hash: 'transit', label: '在途', count: 'transit'},
  {hash: 'shipping', label: '售出中', count: 'shipping'},
] as const;
// 以展示为主的用户（默认首页是收藏展示）：「展示」是底栏第一个标签；
// 以管理为主的用户不占标签，改用库存页 / 展示页顶栏的「库存｜展示」切换（ShowcaseSwitch）。
export const GALLERY_TAB = {hash: 'gallery', label: '展示', count: ''} as const;

export type MobileTab = {hash: string; label: string; count: string};

/** 底栏从左到右的标签（不含末尾固定的「更多」） */
export function mobileTabs(modules: ModuleFlags, showcaseTab: boolean): MobileTab[] {
  return [...(showcaseTab ? [GALLERY_TAB] : []), ...MOBILE_TABS].filter(n => pageEnabled(n.hash, modules)).map(n => ({...n,
    label: n.hash === 'domestic' && !modules.circulation ? '收藏' : n.label,
  }));
}

/** 底栏槽位顺序，含末尾的「更多」 */
export const mobileTabOrder = (modules: ModuleFlags, showcaseTab: boolean) =>
  [...mobileTabs(modules, showcaseTab).map(t => t.hash), 'more'];

export type PageMotion =
  | {kind: 'none'}
  | {kind: 'switch'}             // 库存 ↔ 展示（以管理为主时的顶栏切换），交给幕布 / 淡入
  | {kind: 'tab'; dir: 1 | -1}   // 底栏之间：1 = 新页在右边
  | {kind: 'push'}               // 进深一层
  | {kind: 'pop'};               // 退回上一层（或直接回到这一列的顶层）

const isShelf = (p: string) => p === 'domestic' || p === 'overseas';
const parentOf = (p: string) => BACK_TARGET[p]?.href.slice(1);

/** 一路往上找到底栏上的那一页：设置 → 更多，回收站 → 设置 → 更多 */
export function rootOf(p: string): string {
  for (let i = 0; i < 8 && parentOf(p); i++) p = parentOf(p)!;
  return p;
}

/** order：mobileTabOrder 的结果；showcaseTab：展示是不是底栏标签 */
export function pageMotion(from: string, to: string, order: string[], showcaseTab: boolean): PageMotion {
  if (!from || from === to || (isShelf(from) && isShelf(to))) return {kind: 'none'};
  if (!showcaseTab && ((from === 'gallery' && isShelf(to)) || (to === 'gallery' && isShelf(from)))) return {kind: 'switch'};
  if (parentOf(to) === from) return {kind: 'push'};
  if (parentOf(from) === to || (parentOf(from) && rootOf(from) === to)) return {kind: 'pop'};
  // 海外库存、以管理为主时的展示页都挂在「库存」标签下
  const slot = (p: string) => {
    const r = rootOf(p);
    const hash = r === 'overseas' || (r === 'gallery' && !showcaseTab) ? 'domestic' : r;
    const i = order.indexOf(hash);
    return i < 0 ? order.length : i;
  };
  return {kind: 'tab', dir: slot(to) >= slot(from) ? 1 : -1};
}
