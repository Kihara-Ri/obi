// 收藏展示的「沉浸」：浏览器全屏 + 安卓壳隐藏系统栏（ObiAndroid.setImmersive），Esc 退出，
// 并在沉浸时让悬浮的「退出」按钮静止 3 秒后淡出、触摸 / 移动时重新出现（chromeIdle）。
import {useEffect, useRef, useState} from 'react';
import {viewSwap} from '../core/view-swap';

const IDLE_MS = 3000;
type AndroidBridge = {setImmersive?: (on: boolean) => void};
const setNativeImmersive = (on: boolean) => {
  try { (window as unknown as {ObiAndroid?: AndroidBridge}).ObiAndroid?.setImmersive?.(on); } catch { /* 旧版壳没有这个方法 */ }
};

const hasNativeImmersive = () => !!(window as unknown as {ObiAndroid?: AndroidBridge}).ObiAndroid?.setImmersive;

export function useImmersive() {
  const [immersive, setImmersive] = useState(false);
  const [chromeIdle, setChromeIdle] = useState(false);
  const ownsFullscreen = useRef(false);
  const requestedFullscreen = useRef(false);
  const mounted = useRef(true);

  const exit = () => {
    viewSwap(() => setImmersive(false));
    setNativeImmersive(false);
    requestedFullscreen.current = false;
    if (ownsFullscreen.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    ownsFullscreen.current = false;
  };
  const enter = () => {
    viewSwap(() => { setImmersive(true); setChromeIdle(false); });
    setNativeImmersive(true);
    // 整个应用进入全屏，抽屉/灯箱仍处于可见树中；不支持时仍可隐藏导航展示。
    // 安卓壳自己隐藏系统栏；WebView 的网页全屏会与它抢系统栏状态（实测状态栏被唤回），所以壳里不再申请
    if (!hasNativeImmersive() && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      requestedFullscreen.current = true;
      void document.documentElement.requestFullscreen().then(() => {
        if (!mounted.current || !requestedFullscreen.current) {
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
          return;
        }
        ownsFullscreen.current = true;
      }).catch(() => {});
    }
  };
  useEffect(() => {
    mounted.current = true;
    const onFullscreen = () => {
      if (ownsFullscreen.current && !document.fullscreenElement) {ownsFullscreen.current = false; viewSwap(() => setImmersive(false)); setNativeImmersive(false);}
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      mounted.current = false;
      requestedFullscreen.current = false;
      document.removeEventListener('fullscreenchange', onFullscreen);
      setNativeImmersive(false);
      if (ownsFullscreen.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!immersive) return;
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape' || document.getElementById('panel') || document.getElementById('lightbox') || document.querySelector('dialog[open]')) return;
      event.preventDefault(); exit();
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [immersive]);
  // 悬浮按钮：3 秒无操作淡出；任何触摸 / 指针 / 按键让它回来
  useEffect(() => {
    if (!immersive) return;
    let timer = 0;
    const wake = () => {
      setChromeIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setChromeIdle(true), IDLE_MS);
    };
    wake();
    const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, wake, {passive: true}));
    return () => { window.clearTimeout(timer); events.forEach(e => window.removeEventListener(e, wake)); };
  }, [immersive]);

  return {immersive, chromeIdle, enter, exit};
}
