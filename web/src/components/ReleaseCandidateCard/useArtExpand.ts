// 卡片内封面放大：封面在头部框内长到整行宽，右侧文字落到封面下面，框随之拉长；再点还原。
// 先切换布局再量「前后」位置（FLIP）：封面按宽高、文字按位移、头部按高度做 WAAPI 过渡，减少动态效果时直接切换。
import {useRef, useState} from 'react';
import {flushSync} from 'react-dom';

const MS = 340;
const EASE = 'cubic-bezier(.2,.7,.3,1)';

export function useArtExpand() {
  const [big, setBig] = useState(false);
  const head = useRef<HTMLButtonElement>(null);
  const art = useRef<HTMLImageElement>(null);
  const running = useRef<Animation[]>([]);

  const toggle = () => {
    const h = head.current, a = art.current;
    if (!h || !a) { setBig(b => !b); return; }
    const moving = Array.from(h.querySelectorAll<HTMLElement>('.rcc-main,.rcc-toggle'));
    const box = (el: HTMLElement) => el.getBoundingClientRect();
    const before = {head: box(h), art: box(a), moving: moving.map(box)};
    running.current.forEach(x => x.cancel());
    flushSync(() => setBig(b => !b));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const after = {head: box(h), art: box(a), moving: moving.map(box)};
    const opts = {duration: MS, easing: EASE};
    const anims = [
      h.animate([{height: before.head.height + 'px', overflow: 'hidden'}, {height: after.head.height + 'px', overflow: 'hidden'}], opts),
      a.animate([{width: before.art.width + 'px', height: before.art.height + 'px'},
                 {width: after.art.width + 'px', height: after.art.height + 'px'}], opts),
      ...moving.map((el, i) => el.animate([
        {transform: `translate(${before.moving[i].left - after.moving[i].left}px,${before.moving[i].top - after.moving[i].top}px)`},
        {transform: 'none'}], opts))];
    running.current = anims;
  };
  return {big, toggle, head, art};
}
