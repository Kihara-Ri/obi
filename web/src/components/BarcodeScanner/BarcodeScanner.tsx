// 相机扫码层：全屏覆盖，后置摄像头取景，识别到有效条码（校验位通过）就回调并关闭。
// 相机需要 HTTPS 与用户授权；失败给出一句原因，调用方仍可手动输入。
import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {makeDetector} from '../../core/barcode-detector';
import {gs1Valid} from '../../core/lookup';
import './BarcodeScanner.css';

export function BarcodeScanner({onDetect, onClose}: {onDetect: (code: string) => void; onClose: () => void}) {
  const video = useRef<HTMLVideoElement>(null);
  const [msg, setMsg] = useState('正在打开相机…');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    let stream: MediaStream | null = null;
    let timer = 0;
    const fail = (text: string) => { if (live) { setMsg(text); setFailed(true); } };
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return fail('当前浏览器或连接不支持相机（需要 HTTPS）');
      try {
        stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}}, audio: false});
      } catch (e) {
        return fail((e as DOMException).name === 'NotAllowedError' ? '没有相机权限，请在浏览器设置里允许后重试' : '无法打开相机');
      }
      if (!live) { stream.getTracks().forEach(t => t.stop()); return; }
      const el = video.current!;
      el.srcObject = stream;
      await el.play().catch(() => {});
      setMsg('正在加载识别器…');
      let detector;
      try { detector = await makeDetector(); } catch { return fail('识别器加载失败，请手动输入'); }
      if (!live) return;
      setMsg('把条码放进框内');
      const tick = async () => {
        if (!live) return;
        try {
          if (el.readyState >= 2) {
            const hit = (await detector.detect(el)).map(b => b.rawValue).find(gs1Valid);
            if (hit) { navigator.vibrate?.(40); onDetect(hit); return; }
          }
        } catch { /* 单帧识别失败忽略，继续下一帧 */ }
        timer = window.setTimeout(tick, 160);
      };
      void tick();
    })();
    return () => { live = false; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, []);
  return createPortal(
    <div className="scan-layer" role="dialog" aria-label="扫描条码">
      <video ref={video} className="scan-video" playsInline muted/>
      <div className="scan-frame" aria-hidden="true"/>
      <p className={'scan-msg' + (failed ? ' is-error' : '')} role="status">{msg}</p>
      <button type="button" className="scan-close" onClick={onClose}>{failed ? '返回' : '取消'}</button>
    </div>, document.body);
}
