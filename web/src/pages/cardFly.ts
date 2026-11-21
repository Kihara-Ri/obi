// 卡片离开 / 换去处时的「封面飞向导航入口」（2026-11-21 从 useListFlip 拆出，库存、售出中、交易记录、海外在途共用）。
// 卡片被摘掉：复制一个替身放回原位，封面飞走、其余部分原地淡出；入口看不到就原地缩小淡出。
// 卡片还在（如包裹签收后挪到「最近签收」）但专辑去了别处：只把封面复制出来飞走，卡片本身由 FLIP 平滑移动。
// 多张专辑的卡片（销售单、包裹）每张封面都飞，最多 MAX_COVERS 张，依次错开。

export const FLY_MS = 620;
export const FADE_MS = 300;
const EASE = 'cubic-bezier(.2,.7,.2,1)';
const MAX_COVERS = 5;

/** 记录状态 → 导航里的入口（hash） */
const DEST: Record<string, string> = {shipping: 'shipping', sold: 'trades', overseas: 'overseas', transit: 'transit',
  domestic: 'domestic', trash: 'trash'};
export const destOfStatus = (status: string | null | undefined) => (status && DEST[status]) || null;

interface Box {x: number; y: number; w: number; h: number}
export type CoverBox = Box & {r: string; el: HTMLElement};
/** 卡片在页面坐标里的位置；covers：卡片内可见封面相对卡片的位置与圆角（卡片被摘掉后量不到，只能在上一帧记下） */
export interface Pos extends Box {el: HTMLElement; parent: HTMLElement | null; covers: CoverBox[]; dest: string | null}

/** 飞行封面的圆角：取封面或其外层的圆角；卡片视图封面本身是直角（圆角在卡片上），退回全局 --radius */
function coverRadius(el: HTMLElement): string {
  const own = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const wrap = el.parentElement ? parseFloat(getComputedStyle(el.parentElement).borderTopLeftRadius) || 0 : 0;
  const r = Math.max(own, wrap);
  const root = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--radius')) || 12;
  return `${r >= 4 ? r : root}px`;
}

/** 卡片里看得见的封面（收起的折叠区里的不算：尺寸为 0 或落在卡片外） */
export function measureCovers(card: HTMLElement, r: DOMRect): CoverBox[] {
  const out: CoverBox[] = [];
  for (const c of card.querySelectorAll<HTMLElement>('.cover')) {
    const cr = c.getBoundingClientRect();
    if (cr.width <= 0 || cr.height <= 0 || cr.top < r.top - 1 || cr.bottom > r.bottom + 1) continue;
    out.push({x: cr.left - r.left, y: cr.top - r.top, w: cr.width, h: cr.height, r: coverRadius(c), el: c});
    if (out.length >= MAX_COVERS) break;
  }
  return out;
}

const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const MORE = new Set(['trades', 'stats', 'lookup', 'settings', 'trash']);

/** 导航里该去处的入口：手机底栏或桌面侧栏，取当前可见的那个。手机上交易记录、回收站在「更多」里，
 *  库存标签指向上次看的那一边（海外 / 国内）；桌面侧栏没有回收站，落到设置 */
export function navTarget(hash: string): HTMLElement | null {
  const sels = [`.mobile-nav a[href="#${hash}"]`, `.sidebar a[data-nav="${hash}"]`];
  if (hash === 'domestic' || hash === 'overseas') sels.push('.mobile-nav a[href="#domestic"]', '.mobile-nav a[href="#overseas"]');
  if (MORE.has(hash)) sels.push('.mobile-nav a[href="#more"]');
  if (hash === 'trash') sels.push('.sidebar a[data-nav="settings"]');
  for (const s of sels) for (const el of document.querySelectorAll<HTMLElement>(s)) if (visible(el)) return el;
  return null;
}

/** 挂在 body 上的替身层（页面层有 overflow 裁切与 transform，飞向侧栏 / 底栏会被裁掉），外面套两层同名 class 的壳，
 *  让按页面 / 列表作用域写的卡片样式照常生效 */
function makeLayer(root: HTMLElement, old: Pos) {
  const layer = document.createElement('div');
  const inner = document.createElement('div');
  layer.className = root.className + ' flip-ghost';
  inner.className = old.parent?.className ?? '';
  layer.setAttribute('aria-hidden', 'true');
  const shell = {position: 'fixed', inset: '0', margin: '0', padding: '0', width: 'auto', height: 'auto', maxWidth: 'none',
    background: 'none', border: '0', boxShadow: 'none', overflow: 'visible', animation: 'none', transform: 'none', pointerEvents: 'none', display: 'block'};
  Object.assign(layer.style, shell, {zIndex: '35'}); // 底栏(30)之上、抽屉(40)之下：抽屉收起时替身在它下面
  Object.assign(inner.style, shell);
  layer.appendChild(inner); document.body.appendChild(layer);
  return {layer, inner};
}

/** 一张封面从卡片里的位置飞向入口，缩小、淡一点；圆角按缩放反算，落到入口时仍是看得见的圆角 */
function flyCover(inner: HTMLElement, src: HTMLElement, c: CoverBox, left: number, top: number, t: DOMRect, delay: number) {
  const fly = src.cloneNode(true) as HTMLElement;
  if (fly instanceof HTMLImageElement) fly.dataset.noReveal = '';
  Object.assign(fly.style, {position: 'fixed', margin: '0', left: `${left + c.x}px`, top: `${top + c.y}px`, width: `${c.w}px`, height: `${c.h}px`,
    objectFit: 'cover', borderRadius: c.r, overflow: 'hidden', opacity: '1', visibility: 'visible', boxShadow: 'var(--shadow)',
    transformOrigin: 'center center', transform: 'none', animation: 'none'});
  inner.appendChild(fly);
  const dx = t.left + t.width / 2 - (left + c.x + c.w / 2), dy = t.top + t.height / 2 - (top + c.y + c.h / 2);
  const s = Math.min(1, 32 / Math.max(c.w, c.h));
  return fly.animate([
    {transform: 'none', opacity: 1, borderRadius: c.r, easing: 'cubic-bezier(.3,0,.4,1)'},
    {transform: 'scale(1.05)', opacity: 1, borderRadius: c.r, offset: .18, easing: 'cubic-bezier(.55,0,.75,.2)'},
    {transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: .35, borderRadius: `${parseFloat(c.r) / s}px`},
  ], {duration: FLY_MS, delay, fill: 'both'});
}

/** 让封面飞向 target。withCard：卡片已被摘掉，连同卡片替身一起放回原位（封面位置留空，其余部分淡出） */
export function flyGhost(root: HTMLElement, old: Pos, target: HTMLElement | null, delay: number, withCard = true) {
  if (!withCard && (!target || !old.covers.length)) return;
  const {layer, inner} = makeLayer(root, old);
  const left = old.x - window.scrollX, top = old.y - window.scrollY;
  let ghost: HTMLElement | null = null;
  if (withCard) {
    ghost = old.el.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('data-id');
    Object.assign(ghost.style, {position: 'fixed', margin: '0', left: `${left}px`, top: `${top}px`, width: `${old.w}px`, height: `${old.h}px`,
      transformOrigin: 'center center'});
    inner.appendChild(ghost);
  }
  const done = () => layer.remove();
  let last: Animation;
  if (target && old.covers.length) {
    const t = target.getBoundingClientRect();
    // 替身里对应的封面藏起来（像被拿走）；卡片还在时直接复制当时那张封面
    const ghostCovers = ghost ? Array.from(ghost.querySelectorAll<HTMLElement>('.cover')) : [];
    const srcCovers = old.el.querySelectorAll<HTMLElement>('.cover');
    const anims = old.covers.map((c, i) => {
      const idx = Array.prototype.indexOf.call(srcCovers, c.el);
      const inGhost = idx >= 0 ? ghostCovers[idx] : undefined;
      if (inGhost) inGhost.style.visibility = 'hidden';
      return flyCover(inner, inGhost ?? c.el, c, left, top, t, delay + i * 70);
    });
    last = anims[anims.length - 1];
    ghost?.animate([{opacity: 1}, {opacity: 0, transform: 'scale(.97)'}], {duration: FADE_MS, delay: delay + 80, easing: EASE, fill: 'both'});
    last.finished.then(() => target.animate([{transform: 'none'}, {transform: 'scale(1.16)'}, {transform: 'none'}],
      {duration: 320, easing: 'cubic-bezier(.3,1.4,.5,1)'})).catch(() => {});
  } else {
    last = ghost!.animate([{transform: 'none', opacity: 1}, {transform: 'scale(.92)', opacity: 0}],
      {duration: FADE_MS, delay, easing: EASE, fill: 'both'});
  }
  last.finished.then(done, done);
  window.setTimeout(done, delay + FLY_MS + MAX_COVERS * 70 + 400); // 后台标签可能推迟 finished
}
