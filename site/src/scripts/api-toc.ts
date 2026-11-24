// 「接口」页汇总栏：宽屏常开、窄屏收起；窄屏选中条目后收回；滚动时高亮当前分组，并把分组名写进收起时的目录条。
// 窄屏目录是浮在页面上的下拉面板，展开 / 收回带过渡（details-motion.ts 的 drop）；客户端配置是手风琴（accordion）。
import { accordion, drop, isOpen } from './details-motion';

accordion(document.querySelectorAll<HTMLDetailsElement>('.clients details'));

const box = document.querySelector<HTMLDetailsElement>('[data-toc]');
if (box) {
  const wide = matchMedia('(min-width: 64rem)');
  const panel = box.querySelector<HTMLElement>('[data-toc-body]');
  const sync = () => { box.open = wide.matches; delete box.dataset.closing; };
  sync();
  wide.addEventListener('change', sync);
  box.querySelector('summary')?.addEventListener('click', (e) => {
    e.preventDefault();
    drop(box, panel, !isOpen(box));
  });
  // 先于 anchors.ts（挂在 document 上）收回；面板浮在页面上，收回不改版面，落点不受过渡影响
  box.addEventListener('click', (e) => {
    if (!wide.matches && (e.target as Element).closest('a') && isOpen(box)) drop(box, panel, false);
  });
  // 宽屏下 summary 不可见，但仍拦一下键盘或脚本触发的收起
  box.addEventListener('toggle', () => { if (wide.matches && !box.open) box.open = true; });

  const now = box.querySelector<HTMLElement>('[data-toc-now]');
  const body = box.querySelector<HTMLElement>('[data-toc-body]');
  const links = new Map<string, HTMLAnchorElement>();
  for (const a of box.querySelectorAll<HTMLAnchorElement>('a[data-toc-link]')) links.set(a.hash.slice(1), a);
  const seen = new Set<string>();
  let current = '';
  const mark = () => {
    // 取文档顺序里第一个仍在观察带内的分组
    const id = [...links.keys()].find((k) => seen.has(k)) ?? current;
    if (id === current) return;
    links.get(current)?.removeAttribute('aria-current');
    const a = links.get(id);
    a?.setAttribute('aria-current', 'true');
    if (now && a) now.textContent = a.firstChild?.textContent ?? '';
    current = id;
    // 宽屏侧栏比视口高时，跟着把当前分组滚进侧栏的可见范围（只滚侧栏，不动页面）
    if (wide.matches && a && body) {
      const r = a.getBoundingClientRect();
      const b = body.getBoundingClientRect();
      if (r.top < b.top || r.bottom > b.bottom) body.scrollTo({ top: body.scrollTop + r.top - b.top - b.height / 3 });
    }
  };
  const watch = new IntersectionObserver((entries) => {
    for (const e of entries) (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id));
    mark();
  }, { rootMargin: '-25% 0px -60% 0px' });
  for (const id of links.keys()) {
    const el = document.getElementById(id);
    if (el) watch.observe(el);
  }
}
