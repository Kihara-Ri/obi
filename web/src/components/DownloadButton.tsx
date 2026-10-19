// 下载按钮：经 core/download 取回文件（应用内保存/分享），失败时 toast 提示，不跳转页面。
import {downloadFile} from '../core/download';
import {useApp} from '../state/AppContext';

type Props = {path: string; fileName: string; className?: string; ariaLabel?: string; children: React.ReactNode};

export function DownloadButton({path, fileName, className = 'link-button', ariaLabel, children}: Props) {
  const app = useApp();
  const onClick = async () => {
    try {
      await downloadFile(path, fileName);
    } catch (err) {
      app.toast(err instanceof Error ? err.message : String(err), 'err');
    }
  };
  return <button type="button" className={className} aria-label={ariaLabel} onClick={onClick}>{children}</button>;
}
