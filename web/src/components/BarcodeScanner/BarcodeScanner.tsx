// 相机扫码层：全屏覆盖，后置摄像头取景，识别到有效条码（校验位通过）就回调并关闭。
// 相机需要 HTTPS 与用户授权；失败给出一句原因，调用方仍可手动输入。
import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {makeDetector} from '../../core/barcode-detector';
import {gs1Valid} from '../../core/lookup';
import './BarcodeScanner.css';

/** 输入框右端的扫码图标按钮：children 是输入框本体，图标嵌在框内，不另占一格。 */
export function ScanField({onScan, onClear, children}: {onScan: () => void; onClear?: () => void; children: React.ReactNode}) {
  const wrap = useRef<HTMLDivElement>(null);
  return <div className={'scan-wrap' + (onClear ? ' has-clear' : '')} ref={wrap}>
    {children}
    {onClear ? <button type="button" className="scan-clear" aria-label="清空输入"
      onClick={() => { onClear(); wrap.current?.querySelector('input')?.focus(); }}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4"
           strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button> : null}
    <button type="button" className="scan-inline" aria-label="扫描条码" onClick={onScan}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10"/>
      </svg>
    </button>
  </div>;
}

const VIDEO = {width: {ideal: 1920}, height: {ideal: 1080}};

type Cam = {id: string; label: string};
const LENS_KEY = 'scan-lens';
const readLens = () => { try { return localStorage.getItem(LENS_KEY) || undefined; } catch { return undefined; } };

/** 多摄手机的 facingMode 常落在长焦上，手持专辑近距离扫码会一直发虚。
 *  拿到权限后列出后置镜头：用户选过的优先；否则排除标签含长焦 / 超广角的，取编号最小的；
 *  自动选不准时，界面上有「切换镜头」，选择会记住。 */
async function openCamera(want?: string): Promise<{stream: MediaStream; cams: Cam[]; current?: string}> {
  let stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}, ...VIDEO}, audio: false});
  let current = stream.getVideoTracks()[0]?.getSettings().deviceId;
  try {
    const cams = (await navigator.mediaDevices.enumerateDevices())
      .filter(d => d.kind === 'videoinput' && /back|rear|environment|后置/i.test(d.label))
      .map(d => ({id: d.deviceId, label: d.label}));
    const index = (label: string) => Number(/camera\d*\s+(\d+)/i.exec(label)?.[1] ?? 99);
    cams.sort((a, b) => index(a.label) - index(b.label));
    const auto = cams.find(c => !/tele|zoom|ultra|wide|长焦|广角/i.test(c.label));
    const target = cams.find(c => c.id === want) ?? auto;
    if (target && target.id !== current) {
      stream.getTracks().forEach(t => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({video: {deviceId: {exact: target.id}, ...VIDEO}, audio: false});
      current = target.id;
    }
    return {stream, cams, current};
  } catch { return {stream, cams: [], current}; }   // 选镜头失败就沿用系统默认
}

type FocusCaps = MediaTrackCapabilities & {focusMode?: string[]; focusDistance?: {min: number; max: number}};

/** Android 默认常是固定焦距或慢速自动对焦，条码近距离会一直发虚：能连续对焦就开，并避免远焦。 */
async function tuneFocus(track?: MediaStreamTrack, retrigger = false) {
  const caps = (track?.getCapabilities?.() ?? {}) as FocusCaps;
  if (!track || !caps.focusMode) return;
  const advanced: Record<string, unknown>[] = [];
  if (retrigger && caps.focusMode.includes('single-shot')) {   // 点按取景：先单次对焦，再回到连续
    try { await track.applyConstraints({advanced: [{focusMode: 'single-shot'}]} as unknown as MediaTrackConstraints); } catch { /* 忽略 */ }
  }
  if (caps.focusMode.includes('continuous')) advanced.push({focusMode: 'continuous'});
  try { await track.applyConstraints({advanced} as unknown as MediaTrackConstraints); } catch { /* 设备不支持就用系统默认 */ }
}

/** 等视频真正稳定：已有首帧、有真实宽高，且最近 250ms 没有再 resize（相机常先出小分辨率 / 小窗再切到目标分辨率）；最多等 1.5s。 */
function settled(el: HTMLVideoElement, live: () => boolean): Promise<void> {
  return new Promise(done => {
    const start = performance.now();
    let lastChange = start, size = '';
    const poll = () => {
      if (!live()) return done();
      const now = performance.now();
      const cur = el.videoWidth + 'x' + el.videoHeight;
      if (cur !== size) { size = cur; lastChange = now; }
      const ready = el.readyState >= 2 && el.videoWidth > 0 && !el.paused;
      if ((ready && now - lastChange > 250) || now - start > 1500) return done();
      requestAnimationFrame(poll);
    };
    poll();
  });
}

export function BarcodeScanner({onDetect, onClose}: {onDetect: (code: string) => void; onClose: () => void}) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | undefined>(undefined);
  const [msg, setMsg] = useState('正在打开相机…');
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(false);   // 画面稳定（有真实尺寸且不再变化）后才对焦显现，之前的小窗 / 播放图标 / 分辨率跳变都藏在暗底后面
  const [armed, setArmed] = useState(false);    // 识别器就绪：取景框由暗淡转为高亮
  const [want, setWant] = useState<string | undefined>(readLens);
  const [cams, setCams] = useState<Cam[]>([]);
  const [lens, setLens] = useState<string | undefined>();
  useEffect(() => {
    setShown(false); setArmed(false); setFailed(false); setMsg('正在打开相机…');
    let live = true;
    let stream: MediaStream | null = null;
    let timer = 0;
    const fail = (text: string) => { if (live) { setMsg(text); setFailed(true); } };
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return fail('当前浏览器或连接不支持相机（需要 HTTPS）');
      try {
        const opened = await openCamera(want);
        stream = opened.stream;
        if (live) { setCams(opened.cams); setLens(opened.current); }
      } catch (e) {
        return fail((e as DOMException).name === 'NotAllowedError' ? '没有相机权限，请在浏览器设置里允许后重试' : '无法打开相机');
      }
      if (!live) { stream.getTracks().forEach(t => t.stop()); return; }
      track.current = stream.getVideoTracks()[0];
      await tuneFocus(track.current);
      const el = video.current!;
      el.srcObject = stream;
      await el.play().catch(() => {});
      await settled(el, () => live);
      if (!live) return;
      setShown(true);
      setMsg('正在加载识别器…');
      let detector;
      try { detector = await makeDetector(); } catch { return fail('识别器加载失败，请手动输入'); }
      if (!live) return;
      setMsg('把条码放进框内');
      setArmed(true);
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
  }, [want]);
  const next = () => {
    const at = cams.findIndex(c => c.id === lens);
    const pick = cams[(at + 1) % cams.length].id;
    try { localStorage.setItem(LENS_KEY, pick); } catch { /* 记不住也能用 */ }
    setWant(pick);
  };
  const at = cams.findIndex(c => c.id === lens);
  return createPortal(
    <div className="scan-layer" role="dialog" aria-label="扫描条码" onClick={() => void tuneFocus(track.current, true)}>
      <video ref={video} className={'scan-video' + (shown ? ' is-live' : '')} playsInline muted autoPlay
             controls={false} disablePictureInPicture/>
      <div className={'scan-frame' + (armed ? ' is-armed' : '')} aria-hidden="true"/>
      <p key={msg} className={'scan-msg' + (failed ? ' is-error' : '')} role="status">{msg}</p>
      {cams.length > 1 && !failed
        ? <button type="button" className="scan-lens" onClick={e => { e.stopPropagation(); next(); }}>
            切换镜头 {at + 1}/{cams.length}<small>{cams[at]?.label.replace(/,?\s*facing back/i, '')}</small>
          </button> : null}
      <button type="button" className="scan-close" onClick={onClose}>{failed ? '返回' : '取消'}</button>
    </div>, document.body);
}
