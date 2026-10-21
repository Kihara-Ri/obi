// 页面导航：手机宽度下用 location.replace 切换页面，不往历史栈里压条目。
// iOS 浏览器从屏幕左缘右划会「返回上一条历史」，应用里顶栏 / 底栏切页若每次都压一条，
// 右划就会退回上一个页面（Web 无法直接禁用这个系统手势）。不留历史，右划就无处可退。
// 抽屉与展示聚焦仍自己压条目（右划 = 关闭抽屉，是想要的行为）。桌面保留正常历史，浏览器后退键照常可用。
const mobile = () => { try { return matchMedia('(max-width:840px)').matches; } catch { return false; } };

export function navigate(hash: string) {
  const target = hash.startsWith('#') ? hash : `#${hash}`;
  if (target === location.hash) return;
  if (mobile()) location.replace(target); else location.hash = target;
}

/** 点击页面内的 #锚点链接（顶栏 / 底栏 / 各页入口）时改走 navigate；抽屉里的链接另有处理，不碰 */
export function installReplaceNav(): () => void {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (!a || a.target || a.closest('#panel') || !mobile()) return;
    const href = a.getAttribute('href') || '';
    if (href.length < 2) return;
    e.preventDefault();
    navigate(href);
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
