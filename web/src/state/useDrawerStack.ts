// 抽屉页面栈：打开 / 返回上一层 / 收起 / 收起后跳页，以及返回手势（popstate）的处理。
// 每层都保持挂载（只有栈顶可见），返回时露出上一层而不是重新创建它，
// 所以详情页的滚动位置、已加载的图片、爱心与照片预取结果都不会因为进出二级页而重新加载。
import {useCallback, useEffect, useRef, useState} from 'react';
import {navigate} from '../core/nav';
import type {DrawerSpec} from './AppContext';

export function useDrawerStack() {
  const [drawer, setDrawer] = useState<DrawerSpec | null>(null);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [drawerPage, setDrawerPage] = useState({key: 0, direction: 'forward' as 'forward' | 'back'});
  const [drawerPages, setDrawerPages] = useState<DrawerSpec[]>([]);
  const drawerDirty = useRef(false);

  // 关闭分两步：closeDrawer 只置 closing（Drawer 播完收回动画后回调 drawerExited 才真正卸载）
  // 每个抽屉会话在历史里压入同址条目：iOS 边缘右滑的「返回」先消费它，popstate 里
  // 把抽屉收回（脏表单先确认），而不是把路由退回上一个页面——所有上拉窗口统一行为。
  const drawerStack = useRef<DrawerSpec[]>([]);
  const syncPages = () => setDrawerPages([...drawerStack.current]);
  const drawerEntries = useRef(0);
  const popGuard = useRef(false);
  const pendingGo = useRef<(() => void) | null>(null);
  const openDrawer = useCallback((spec: DrawerSpec) => {
    drawerDirty.current = false;
    setDrawerClosing(false);
    setDrawer(spec);
    setDrawerPage(p => ({key: p.key + 1, direction: spec.direction === 'back' ? 'back' : 'forward'}));
    drawerStack.current.push(spec);
    syncPages();
    history.pushState({obi: 'drawer'}, '');
    drawerEntries.current++;
  }, []);

  const confirmDiscard = () => !drawerDirty.current || confirm('还没有保存，确定放弃这次修改吗？');

  const closeDrawer = useCallback((force = false): boolean => {
    if (!force && !confirmDiscard()) return false;
    drawerStack.current = []; // 收回动画期间到达的返回手势不再命中抽屉
    setDrawerClosing(true);
    return true;
  }, []);

  // 抽屉里的页面跳转：收起后再设 hash。收起时的 history.go(-n) 是异步的，先改 hash 会被它撤销，
  // 所以把跳转挂到「历史还原完成」的那次 popstate（或无历史条目时直接）之后执行。
  const afterExit = useRef<(() => void) | null>(null);
  const closeDrawerAndGo = useCallback((hash: string): boolean => {
    if (!drawerStack.current.length && !drawer) { navigate(hash); return true; }
    if (!closeDrawer()) return false;
    afterExit.current = () => { navigate(hash); };
    return true;
  }, [closeDrawer, drawer]);

  // 回到上一层（取消键）：与返回手势的 popstate 分支同一语义——弹出栈顶、恢复上一层抽屉、按「返回」方向播动画。
  // 这里是程序性返回，浏览器历史条目要自己退掉；popGuard 让随之而来的 popstate 被忽略，避免再弹一层。
  const backDrawer = useCallback((force = false): boolean => {
    const stack = drawerStack.current;
    if (stack.length < 2) return closeDrawer(force);
    if (!force && !confirmDiscard()) return false;
    stack.pop();
    drawerEntries.current = Math.max(0, drawerEntries.current - 1);
    drawerDirty.current = false;
    setDrawerClosing(false);
    setDrawer(stack[stack.length - 1]);
    setDrawerPage(p => ({key: p.key + 1, direction: 'back'}));
    syncPages();
    popGuard.current = true;
    history.back();
    return true;
  }, [closeDrawer]);

  const drawerExited = useCallback(() => {
    setDrawer(null); setDrawerClosing(false);
    drawerStack.current = [];
    setDrawerPages([]);
    const next = afterExit.current;
    afterExit.current = null;
    if (drawerEntries.current > 0) {
      popGuard.current = true;
      pendingGo.current = next;
      history.go(-drawerEntries.current);
      drawerEntries.current = 0;
    } else next?.();
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (popGuard.current) {
        popGuard.current = false;
        const go = pendingGo.current;
        pendingGo.current = null;
        go?.();
        return;
      }
      const stack = drawerStack.current;
      if (!stack.length) {
        if (drawerEntries.current > 0) drawerEntries.current--; // 收回动画期间的手势先消费守卫条目
        return; // 无抽屉时的返回 = 正常路由后退，交给 hashchange
      }
      if (!confirmDiscard()) {
        history.pushState({obi: 'drawer'}, ''); // 用户取消放弃：补回刚消费的守卫条目
        return;
      }
      stack.pop();
      drawerEntries.current = Math.max(0, drawerEntries.current - 1);
      if (stack.length) {
        // 艺人抽屉等往返场景：返回手势回到上一层抽屉（重挂载，与「返回」按钮同语义）
        drawerDirty.current = false;
        setDrawerClosing(false);
        setDrawer(stack[stack.length - 1]);
        setDrawerPage(p => ({key: p.key + 1, direction: 'back'}));
        setDrawerPages([...stack]);
      } else {
        setDrawerClosing(true);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setDrawerDirty = useCallback((v: boolean) => { drawerDirty.current = v; }, []);

  return {
    drawer, drawerClosing, drawerPage, drawerPages, drawerExited,
    openDrawer, closeDrawer, backDrawer, closeDrawerAndGo, setDrawerDirty,
  };
}
