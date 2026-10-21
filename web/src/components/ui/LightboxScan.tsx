// 灯箱里的「识别条码并查询」：用应用内的扫码识别器读当前这张照片，识别到有效条码就直接去查询页搜索，
// 不用自己抄数字。识别失败在原地提示，灯箱保持打开，可以翻到拍了条码的那张再试。
import {useEffect, useState} from 'react';
import {barcodeFromPhoto} from '../../core/photo-barcode';
import {queueLookup} from '../../core/lookup-handoff';
import {useApp} from '../../state/AppContext';

export function LightboxScan({src, onDone}: {src: string; onDone: () => void}) {
  const app = useApp();
  const [state, setState] = useState<'idle' | 'busy' | 'miss' | 'error'>('idle');
  useEffect(() => { setState('idle'); }, [src]);   // 翻到别的照片后清掉上一张的提示
  const run = async () => {
    setState('busy');
    try {
      const code = await barcodeFromPhoto(src);
      if (!code) { setState('miss'); return; }
      queueLookup(code);
      onDone();
      app.closeDrawerAndGo('#lookup');
    } catch { setState('error'); }
  };
  return (
    <div className="lb-scan">
      {state === 'miss' ? <span className="lb-scan-msg" role="status">这张照片里没有识别到条码，翻到拍了条码的那张再试</span> : null}
      {state === 'error' ? <span className="lb-scan-msg" role="alert">识别器加载失败，请稍后重试</span> : null}
      <button type="button" className="lb-scan-btn" disabled={state === 'busy'} onClick={() => void run()}>
        {state === 'busy' ? '识别中…' : '识别条码并查询'}
      </button>
    </div>
  );
}
