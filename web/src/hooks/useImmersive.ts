// 收藏展示的「沉浸」：浏览器全屏 + 安卓壳隐藏系统栏（ObiAndroid.setImmersive），Esc 退出，
// 安卓壳里进入后读原生快照（probe）供界面诊断；并在沉浸时让悬浮的「退出」按钮静止 3 秒后淡出、触摸 / 移动时重新出现（chromeIdle）。
import {useEffect, useRef, useState} from 'react';
import {viewSwap} from '../core/view-swap';
import {callNativeImmersive, inAndroidShell, readNativeImmersive} from '../core/android-immersive';
import type {NativeCall, NativeReport} from '../core/android-immersive';

const IDLE_MS = 3000;
// 原生在进入后 2.2 秒自检系统栏，这里稍晚再读它的快照
const DIAG_MS = 2600;
export type ImmersiveProbe = {call: NativeCall; report: NativeReport | null | undefined};

const setNativeImmersive = (on: boolean) => callNativeImmersive(on);

const hasNativeImmersive = () => typeof (window as unknown as {ObiAndroid?: {setImmersive?: unknown}}).ObiAndroid?.setImmersive === 'function';

export function useImmersive() {
  const [immersive, setImmersive] = useState(false);
  const [chromeIdle, setChromeIdle] = useState(false);
  const [probe, setProbe] = useState<ImmersiveProbe | null>(null);
  const lastCall = useRef<NativeCall>('none');
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
    setProbe(null);
    lastCall.current = setNativeImmersive(true);
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
  // 安卓壳：进入沉浸后读原生快照，交给 ImmersiveDiag 判断执行到了哪一步
  useEffect(() => {
    if (!immersive || !inAndroidShell()) return;
    // 原生还没自检完（比如窗口焦点变化又重走了一次隐藏）就再等一轮，最多三轮
    let timer = 0;
    const read = (tries: number) => {
      const report = readNativeImmersive();
      if (report && report.on && report.stage !== 'checked' && tries > 1) { timer = window.setTimeout(() => read(tries - 1), DIAG_MS); return; }
      setProbe({call: lastCall.current, report});
    };
    timer = window.setTimeout(() => read(3), DIAG_MS);
    return () => window.clearTimeout(timer);
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

  return {immersive, chromeIdle, enter, exit, probe: immersive ? probe : null};
}
