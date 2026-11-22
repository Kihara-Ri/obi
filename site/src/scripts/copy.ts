// 「复制」按钮：把 data-copy 的命令写入剪贴板，按钮短暂显示「已复制」（形状 + 文字，不只靠颜色）。
// 剪贴板不可用（非安全上下文、权限拒绝）时退回选中代码块，让用户手动复制。
for (const btn of document.querySelectorAll<HTMLButtonElement>('button[data-copy]')) {
  btn.addEventListener('click', async () => {
    const text = btn.dataset.copy ?? '';
    try {
      await navigator.clipboard.writeText(text);
      btn.dataset.done = '';
      btn.textContent = '已复制';
      setTimeout(() => { delete btn.dataset.done; btn.textContent = '复制'; }, 1600);
    } catch {
      const code = btn.closest('li')?.querySelector('code');
      if (code) getSelection()?.selectAllChildren(code);
    }
  });
}
