// 安卓应用的自动更新状态（只在安卓壳里显示）：更新由原生 Updater 在后台完成，这里只展示进度、手动检查，
// 以及在 Android 12+ 引导用户一次性允许「安装未知应用」，之后更新无需确认。
import {useEffect, useState} from 'react';

type Native = {updateStatus(): string; checkUpdate(): void; openInstallSettings(): void; installUpdate?(): void};
type Status = {state: string; version: string; latest: string; ready: string; error: string;
  checkedAt: number; silent: boolean; silentSupported: boolean; installable?: boolean};

function native(): Native | null {
  const bridge = (window as unknown as {ObiAndroid?: Partial<Native>}).ObiAndroid;
  return bridge && typeof bridge.updateStatus === 'function' ? bridge as Native : null;
}

function read(bridge: Native): Status | null {
  try { return JSON.parse(bridge.updateStatus()) as Status; } catch { return null; }
}

const tag = (v: string) => v.replace(/^v/, '');
const clock = (ms: number) => new Date(ms).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});

export function describeUpdate(s: Status): string {
  switch (s.state) {
    case 'checking': return '正在检查新版本…';
    case 'downloading': return '正在下载新版本…';
    case 'ready': return `新版本 ${tag(s.ready)} 已下载，点「安装」更新`;
    case 'installing': return '正在安装新版本…';
    case 'confirming': return '请在系统页面确认安装';
    case 'current': return `已是最新${s.checkedAt ? `（${clock(s.checkedAt)} 检查）` : ''}`;
    case 'error': return `暂未更新：${s.error || '检查失败'}`;
    default: return '尚未检查';
  }
}

const BUSY = new Set(['checking', 'downloading', 'installing']);

export function AppUpdateSection() {
  const bridge = native();
  const [status, setStatus] = useState<Status | null>(() => bridge && read(bridge));
  useEffect(() => {
    if (!bridge) return;
    const timer = window.setInterval(() => setStatus(read(bridge)), 1500);
    return () => window.clearInterval(timer);
  }, [bridge]);
  if (!bridge || !status) return null;
  const busy = BUSY.has(status.state);
  return <section className="settings-section">
    <h3>应用更新</h3>
    <p role="status">当前版本 {status.version} · {describeUpdate(status)}</p>
    <p className="small-note">
      {status.silent
        ? '自动更新已开启：每 30 分钟检查一次，新版本在你离开应用时自动安装，数据保留。'
        : status.silentSupported
          ? '允许 Obi「安装未知应用」后，新版本会在你离开应用时自动安装，不再询问。未允许时，有新版本会弹窗请你确认。'
          : '自动检查并下载新版本；这个系统版本每次安装需要在系统页面确认一次。'}
    </p>
    <div className="inline-actions">
      <button type="button" className="link-button" disabled={busy} aria-busy={busy}
              onClick={() => { bridge.checkUpdate(); setStatus({...status, state: 'checking'}); }}>检查更新</button>
      {status.state === 'ready' && status.installable && bridge.installUpdate
        ? <button type="button" className="link-button" onClick={() => bridge.installUpdate?.()}>安装 {tag(status.ready)}</button>
        : null}
      {status.silentSupported && !status.silent
        ? <button type="button" className="link-button" onClick={() => bridge.openInstallSettings()}>允许自动安装</button>
        : null}
    </div>
  </section>;
}
