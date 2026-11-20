// 库存卡片 / 列表行的重排转场（FLIP）：搜索、排序、筛选、新增、移除、售出后，
// 留下的卡片从旧位置平滑移到新位置，新出现的卡片淡入并轻微放大。
// 被移除的卡片（售出、调走、删除）：React 已把节点摘掉，这里用上一帧记下的元素复制一个替身放回原位，
// 只把带圆角的封面飞向去处在导航里的入口（售出 → 「售出中」，入口随后轻跳一下），卡片其余部分原地淡出
// （2026-11-20：原来整张卡片一起飞，太重）；入口看不到（删除、选择模式隐藏了底栏、只是被筛选掉）就原地
// 缩小淡出。后面的卡片稍等替身离开再上移补位（2026-11-19）。
// orderKey 变化才触发；scopeKey（页面 / 视图）变化说明是整页切换，由别处负责，这里只刷新记录。
import {useLayoutEffect, useRef} from 'react';

const MAX = 60;
const MAX_GHOSTS = 12;
const MOVE_MS = 380;
const FLY_MS = 620;
const FADE_MS = 300;
const EASE = 'cubic-bezier(.2,.7,.2,1)';
/** 记录状态 → 导航里的入口（hash） */
const DEST: Record<string, string> = {shipping: 'shipping', sold: 'trades', overseas: 'overseas', transit: 'transit', domestic: 'domestic'};

interface Box {x: number; y: number; w: number; h: number}
/** cover：封面相对卡片的位置与圆角（卡片被摘掉后量不到，只能在上一帧记下） */
interface Pos extends Box {el: HTMLElement; parent: HTMLElement | null; cover: (Box & {r: string}) | null}

/** 飞行封面的圆角：取封面或其外层的圆角；卡片视图封面本身是直角（圆角在卡片上），退回全局 --radius */
function coverRadius(el: HTMLElement): string {
  const own = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const wrap = el.parentElement ? parseFloat(getComputedStyle(el.parentElement).borderTopLeftRadius) || 0 : 0;
  const r = Math.max(own, wrap);
  const root = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--radius')) || 12;
  return `${r >= 4 ? r : root}px`;
}

function measure(root: HTMLElement): Map<string, Pos> {
  const map = new Map<string, Pos>();
  const sx = window.scrollX, sy = window.scrollY;
  root.querySelectorAll<HTMLElement>('.card[data-id]').forEach(card => {
    const r = card.getBoundingClientRect();
    if (r.width <= 0) return;
    const c = card.querySelector<HTMLElement>('.cover');
    const cr = c?.getBoundingClientRect();
    const cover = c && cr && cr.width > 0 ? {x: cr.left - r.left, y: cr.top - r.top, w: cr.width, h: cr.height, r: coverRadius(c)} : null;
    map.set(card.dataset.id!, {x: r.left + sx, y: r.top + sy, w: r.width, h: r.height, el: card, parent: card.parentElement, cover});
  });
  return map;
}

/** 导航里该去处的入口：手机底栏或桌面侧栏，取当前可见的那个 */
function navTarget(hash: string): HTMLElement | null {
  const els = document.querySelectorAll<HTMLElement>(`.mobile-nav a[href="#${hash}"], .sidebar a[data-nav="${hash}"]`);
  for (const el of els) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return el; }
  return null;
}

/** 把被摘掉的卡片复制一份放回旧位置，飞走或淡出后移除。替身挂在 body 上（页面层有 overflow 裁切与
 *  transform，飞向侧栏 / 底栏会被裁掉），外面套两层同名 class 的壳，让按页面 / 列表作用域写的卡片样式照常生效 */
function flyGhost(root: HTMLElement, old: Pos, target: HTMLElement | null, delay: number) {
  const ghost = old.el.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('data-id');
  const layer = document.createElement('div');
  const inner = document.createElement('div');
  layer.className = root.className + ' flip-ghost';
  inner.className = old.parent?.className ?? '';
  layer.setAttribute('aria-hidden', 'true');
  const shell = {position: 'fixed', inset: '0', margin: '0', padding: '0', width: 'auto', height: 'auto', maxWidth: 'none',
    background: 'none', border: '0', boxShadow: 'none', overflow: 'visible', animation: 'none', transform: 'none', pointerEvents: 'none', display: 'block'};
  Object.assign(layer.style, shell, {zIndex: '35'}); // 底栏(30)之上、抽屉(40)之下：抽屉收起时替身在它下面
  Object.assign(inner.style, shell);
  const left = old.x - window.scrollX, top = old.y - window.scrollY;
  Object.assign(ghost.style, {position: 'fixed', margin: '0', left: `${left}px`, top: `${top}px`, width: `${old.w}px`, height: `${old.h}px`,
    transformOrigin: 'center center'});
  inner.appendChild(ghost); layer.appendChild(inner); document.body.appendChild(layer);
  const done = () => layer.remove();
  let anim: Animation;
  const src = ghost.querySelector<HTMLElement>('.cover');
  if (target && old.cover && src) {
    // 封面单独抽出来飞：卡片替身里的封面位置留空（露出底色），像被拿走；卡片其余部分原地淡出
    const c = old.cover;
    const fly = src.cloneNode(true) as HTMLElement;
    if (fly instanceof HTMLImageElement) fly.dataset.noReveal = '';
    src.style.visibility = 'hidden';
    Object.assign(fly.style, {position: 'fixed', margin: '0', left: `${left + c.x}px`, top: `${top + c.y}px`, width: `${c.w}px`, height: `${c.h}px`,
      objectFit: 'cover', borderRadius: c.r, overflow: 'hidden', opacity: '1', visibility: 'visible', boxShadow: 'var(--shadow)', transformOrigin: 'center center'});
    inner.appendChild(fly);
    const t = target.getBoundingClientRect();
    const dx = t.left + t.width / 2 - (left + c.x + c.w / 2), dy = t.top + t.height / 2 - (top + c.y + c.h / 2);
    const s = Math.min(1, 32 / Math.max(c.w, c.h));
    // 圆角按缩放反算，落到入口时仍是看得见的圆角
    const endRadius = `${parseFloat(c.r) / s}px`;
    anim = fly.animate([
      {transform: 'none', opacity: 1, borderRadius: c.r, easing: 'cubic-bezier(.3,0,.4,1)'},
      {transform: 'scale(1.05)', opacity: 1, borderRadius: c.r, offset: .18, easing: 'cubic-bezier(.55,0,.75,.2)'},
      {transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: .35, borderRadius: endRadius},
    ], {duration: FLY_MS, delay, fill: 'both'});
    ghost.animate([{opacity: 1}, {opacity: 0, transform: 'scale(.97)'}], {duration: FADE_MS, delay: delay + 80, easing: EASE, fill: 'both'});
    anim.finished.then(() => target.animate([{transform: 'none'}, {transform: 'scale(1.16)'}, {transform: 'none'}],
      {duration: 320, easing: 'cubic-bezier(.3,1.4,.5,1)'})).catch(() => {});
  } else {
    anim = ghost.animate([{transform: 'none', opacity: 1}, {transform: 'scale(.92)', opacity: 0}],
      {duration: FADE_MS, delay, easing: EASE, fill: 'both'});
  }
  anim.finished.then(done, done);
  window.setTimeout(done, delay + FLY_MS + 400); // 后台标签可能推迟 finished
}

export function useListFlip(root: React.RefObject<HTMLElement | null>, orderKey: string, scopeKey: string,
                            statusOf?: (id: string) => string | null) {
  const last = useRef<{map: Map<string, Pos>; order: string; scope: string} | null>(null);

  useLayoutEffect(() => {
    const page = root.current;
    if (!page) return;
    const prev = last.current;
    const sx = window.scrollX, sy = window.scrollY;
    const animate = prev && prev.scope === scopeKey && prev.order !== orderKey && typeof page.animate === 'function'
      && !(() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } })();
    if (animate) {
      // 先放替身：抽屉还在收起时稍等它让开，替身才看得见
      const present = new Set(Array.from(page.querySelectorAll<HTMLElement>('.card[data-id]'), c => c.dataset.id!));
      const wait = document.querySelector('.drawer') ? 200 : 0;
      const here = scopeKey.split('|')[0];
      let ghosts = 0;
      prev.map.forEach((old, id) => {
        if (present.has(id) || ghosts >= MAX_GHOSTS) return;
        const top = old.y - sy;
        if (top + old.h < 0 || top > window.innerHeight) return;
        const dest = DEST[statusOf?.(id) ?? ''];
        flyGhost(page, old, dest && dest !== here ? navTarget(dest) : null, wait + ghosts * 40);
        ghosts++;
      });
      const moveDelay = ghosts ? wait + 140 : 0;
      let count = 0;
      page.querySelectorAll<HTMLElement>('.card[data-id]').forEach(card => {
        const r = card.getBoundingClientRect();
        if (r.width <= 0 || r.bottom < -80 || r.top > window.innerHeight + 80 || count >= MAX) return;
        const old = prev.map.get(card.dataset.id!);
        count++;
        if (!old) {
          card.animate([{opacity: 0, transform: 'scale(.95)'}, {opacity: 1, transform: 'none'}],
            {duration: 260, easing: EASE, delay: Math.min(count, 12) * 12, fill: 'backwards'});
          return;
        }
        const dx = old.x - (r.left + sx);
        const dy = old.y - (r.top + sy);
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        card.animate([{transform: `translate(${dx}px,${dy}px)`}, {transform: 'none'}],
          {duration: MOVE_MS, easing: EASE, delay: moveDelay, fill: 'backwards'});
      });
    }
    last.current = {map: measure(page), order: orderKey, scope: scopeKey};
  });
}
