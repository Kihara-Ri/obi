// OpenCode 网页登录：打开 opencode.ai/auth（系统浏览器），用户登录并复制 API Key 后回到 Obi，自动读剪贴板回填密钥框。
// OpenCode 没有给第三方应用的 OAuth，底层仍是 Console 密钥；只回填、不自动保存，也不读取网页登录态。
import {useEffect, useState} from 'react';
import {looksLikeKey, readClipboardText} from '../../core/clipboard';

const AUTH_URL = 'https://opencode.ai/auth';

export function OpenCodeLogin({busy, onKey}: {busy: boolean; onKey: (key: string) => void}) {
  const [waiting, setWaiting] = useState(false);
  const [note, setNote] = useState('');

  const take = async (manual: boolean) => {
    const text = (await readClipboardText()).trim();
    if (looksLikeKey(text)) {
      onKey(text); setWaiting(false);
      setNote('已从剪贴板填入密钥，确认无误后点「保存密钥」。');
      return true;
    }
    if (manual) setNote('剪贴板里没有密钥：在 OpenCode 页面复制 API Key 后再点「粘贴」，或直接手动填写。');
    return false;
  };

  // 从浏览器回来：页面重新可见 / 获得焦点时读一次（安卓 10 起要有焦点才读得到剪贴板，所以两个事件都试）
  useEffect(() => {
    if (!waiting) return;
    let timer = 0;
    const back = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      timer = window.setTimeout(() => {void take(false).then(ok => {
        if (!ok) setNote('回来后没在剪贴板找到密钥：在 OpenCode 页面复制 API Key 后点「粘贴」。');
      });}, 300);
    };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('focus', back);
    return () => {clearTimeout(timer); document.removeEventListener('visibilitychange', back); window.removeEventListener('focus', back);};
  }, [waiting]);

  return <div className="provider-login">
    <div className="provider-keyrow">
      <a className="provider-login-go" href={AUTH_URL} target="_blank" rel="noopener noreferrer"
        aria-disabled={busy || undefined} onClick={() => {setWaiting(true); setNote('在打开的页面登录 OpenCode，复制 API Key 后回到这里。');}}>
        用 OpenCode 账户登录</a>
      <button type="button" disabled={busy} onClick={() => {void take(true);}}>粘贴</button>
    </div>
    {note ? <p className="small-note" role="status">{note}</p> : null}
  </div>;
}
