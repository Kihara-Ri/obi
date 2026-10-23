// 子页左缘右划返回时垫在内容下面的「上一级」页面（hooks/useEdgeSwipeBack.ts 通过 obi-peek 事件开关）：
// 内容右移时露出它，顶栏由 CSS 隐藏（顶栏始终是当前页的那一个）。只在手势期间挂载，不接收点击与焦点。
import {useEffect, useState} from 'react';
import {lazyPage} from '../core/lazy-page';

const MorePage = lazyPage(() => import('../pages/MorePage').then(m => m.MorePage));
const SettingsPage = lazyPage(() => import('../pages/SettingsPage').then(m => m.SettingsPage));

export function PeekUnderlay() {
  const [page, setPage] = useState('');
  useEffect(() => {
    const on = (e: Event) => setPage((e as CustomEvent<string>).detail || '');
    window.addEventListener('obi-peek', on);
    return () => window.removeEventListener('obi-peek', on);
  }, []);
  if (!page) return null;
  return <div className="swipe-underlay" aria-hidden="true" inert>
    <main id="main-peek"><div className="page-layer">
      {page === 'settings' ? <SettingsPage/> : <MorePage installEvt={null} onInstalled={() => {}}/>}
    </div></main>
  </div>;
}
