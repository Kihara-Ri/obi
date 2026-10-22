// 下载按钮：经 core/download 取回文件（应用内保存/分享）；处理中禁用并标记 aria-busy，完成与失败各弹一条提示，不跳转页面。
import {useState} from 'react';
import {downloadFile, savedPlace} from '../core/download';
import {useApp} from '../state/AppContext';

type Props = {path: string; fileName: string; className?: string; ariaLabel?: string; children: React.ReactNode};

export function DownloadButton({path, fileName, className = 'link-button', ariaLabel, children}: Props) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const name = await downloadFile(path, fileName);
      app.toast(`已保存 ${name}${savedPlace() ? ' ' + savedPlace() : ''}`);
    } catch (err) {
      app.toast(err instanceof Error ? err.message : String(err), 'err');
    } finally {
      setBusy(false);
    }
  };
  return <button type="button" className={className} aria-label={ariaLabel} aria-busy={busy} disabled={busy}
                 onClick={onClick}>{children}</button>;
}
