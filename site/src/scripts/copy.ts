// 「复制」按钮：把 data-copy 的命令写入剪贴板。按钮只有图标，复制后短暂切到「已复制」状态（data-done：
// 图标换成对勾、按钮变成盖章样式，形状变而不只靠颜色），同时改 aria-label / title 让读屏和悬停提示跟着变。
// 剪贴板不可用（非安全上下文、权限拒绝）时退回选中代码块，让用户手动复制。
for (const btn of document.querySelectorAll<HTMLButtonElement>('button[data-copy]')) {
  const label = btn.getAttribute('aria-label') ?? '复制';
  btn.addEventListener('click', async () => {
    const text = btn.dataset.copy ?? '';
    try {
      await navigator.clipboard.writeText(text);
      btn.dataset.done = '';
      btn.setAttribute('aria-label', '已复制');
      btn.title = '已复制';
      setTimeout(() => { delete btn.dataset.done; btn.setAttribute('aria-label', label); btn.title = '复制'; }, 1600);
    } catch {
      const code = btn.closest('li')?.querySelector('code');
      if (code) getSelection()?.selectAllChildren(code);
    }
  });
}
