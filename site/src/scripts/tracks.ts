// 「开始使用」曲目表的展开 / 收起过渡：原生 <details> 开合是瞬间的，这里接管点击，用高度动画平滑展开和收回。
// 互斥（同时只开一首）也由这里负责：脚本运行后去掉 name 属性，避免浏览器把旧的一首瞬间关掉；没有 JS 时仍靠 name 互斥。
// 时长与缓动读 --dur-slow / --ease-out token，与应用面板进出一致；减少动效时直接开合。
const list = document.querySelectorAll<HTMLDetailsElement>('#start details');
const css = getComputedStyle(document.documentElement);
const ms = (parseFloat(css.getPropertyValue('--dur-slow')) || 0.28) * 1000;
const easing = css.getPropertyValue('--ease-out').trim() || 'ease-out';
const still = matchMedia('(prefers-reduced-motion: reduce)');
const running = new WeakMap<HTMLDetailsElement, Animation>();

function animate(d: HTMLDetailsElement, open: boolean) {
  const body = d.querySelector<HTMLElement>('.body');
  running.get(d)?.cancel();
  if (!body || still.matches) { d.open = open; delete d.dataset.closing; return; }
  const from = d.open ? body.getBoundingClientRect().height : 0;
  if (open) { d.open = true; delete d.dataset.closing; } else { d.dataset.closing = ''; }
  const to = open ? body.scrollHeight : 0;
  body.style.overflow = 'hidden';
  const a = body.animate(
    [{ height: `${from}px`, opacity: open ? 0 : 1 }, { height: `${to}px`, opacity: open ? 1 : 0 }],
    { duration: ms, easing },
  );
  running.set(d, a);
  a.onfinish = () => {
    if (!open) { d.open = false; delete d.dataset.closing; }
    body.style.overflow = '';
    running.delete(d);
  };
}

for (const d of list) {
  d.removeAttribute('name');
  d.querySelector('summary')?.addEventListener('click', (e) => {
    e.preventDefault();
    const opening = !d.open || d.dataset.closing !== undefined;
    if (opening) for (const o of list) if (o !== d && o.open && o.dataset.closing === undefined) animate(o, false);
    animate(d, opening);
  });
}
