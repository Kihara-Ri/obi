// 灯箱顶栏（2026-11-19）：左「关闭」、中「第几张 / 共几张」、右「保存」。
// 手机上没有其他明确的退出方式（只能点背景），保存也不必再靠系统长按菜单。
import {useState} from 'react';
import {useApp} from '../../state/AppContext';
import {CheckIco, CloseIco, DownloadIco, SpinIco} from '../icons';
import {savePhoto, touchDevice, usePhotoFile} from './photoSave';
import './PhotoSave.css';

export function LightboxBar({src, index, count, onClose}: {src: string; index: number; count: number; onClose: () => void}) {
  const app = useApp();
  const {file, failed} = usePhotoFile(src);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'done'>('idle');
  const save = () => {
    if (!file || phase === 'saving') return;
    setPhase('saving');
    savePhoto(file).then(msg => {
      if (msg) app.toast(msg);
      setPhase(msg ? 'done' : 'idle');
      if (msg) window.setTimeout(() => setPhase('idle'), 1800);
    }, () => { app.toast('保存失败，请重试', 'err'); setPhase('idle'); });
  };
  const label = touchDevice() ? '保存到相册' : '下载这张照片';
  return (
    <div className="lb-bar">
      <button type="button" className="lb-btn" aria-label="关闭" onClick={onClose}>{CloseIco}</button>
      {count > 1 ? <span className="lb-count" aria-live="polite">{index + 1} / {count}</span> : <span/>}
      <button type="button" className="lb-btn" aria-label={label} title={label} disabled={!file || failed}
              aria-busy={!file || phase === 'saving'} onClick={save}>
        {!file && !failed || phase === 'saving' ? SpinIco : phase === 'done' ? CheckIco : DownloadIco}
      </button>
    </div>
  );
}
