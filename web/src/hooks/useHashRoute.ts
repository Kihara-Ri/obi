// 保留空路由，待服务端状态到达后由应用选择用户设置的首页。
import {createContext, useContext, useEffect, useState} from 'react';

// 页面内容实际提交的那一页（App 里 useDeferredValue 之后的 page）。页面树里的组件（如 PageHead 的返回钮）
// 要跟内容同步：直接读 hash 会比内容早一拍，旧页顶栏先冒出新页的返回钮。
export const ShownPage = createContext<string | null>(null);
export function useShownRoute(): string {
  const live = useHashRoute();
  return useContext(ShownPage) ?? live;
}

export function useHashRoute(): string {
  const [page, setPage] = useState(() => location.hash.slice(1));
  useEffect(() => {
    const on = () => setPage(location.hash.slice(1));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return page;
}
