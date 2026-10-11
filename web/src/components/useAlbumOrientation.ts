import {useCallback, useEffect, useRef, useState} from 'react';
import {albumOrientationReading, albumOrientationTilt} from '../core/album-orientation';
import type {AlbumOrientationReading} from '../core/album-orientation';

export type AlbumOrientationStatus = 'idle' | 'requesting' | 'waiting' | 'enabled' | 'paused' |
  'denied' | 'unavailable' | 'no-signal' | 'reduced-motion';

interface AlbumOrientationOptions {
  active: boolean;
  permission?: Promise<AlbumOrientationPermission>;
  /** Relative degrees to add to the viewer's current manual rotateX / rotateY. */
  onTilt(x: number, y: number): void;
}

type PermissionOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export type AlbumOrientationPermission = 'granted' | 'denied' | 'unavailable';

/** Start in the cover's click handler, before React mounts the lightbox. */
export function requestAlbumOrientationPermission(): Promise<AlbumOrientationPermission> {
  if (unavailableReason()) return Promise.resolve('unavailable');
  if (!navigator.maxTouchPoints && !window.matchMedia('(pointer: coarse)').matches) return Promise.resolve('unavailable');
  try {
    const Orientation = window.DeviceOrientationEvent as PermissionOrientation;
    const permission = Orientation.requestPermission?.call(Orientation);
    return permission ? permission.catch(() => 'denied' as const) : Promise.resolve('granted');
  } catch {return Promise.resolve('denied');}
}

function unavailableReason(): string | null {
  if (!window.isSecureContext) return '运动感应需要 HTTPS，仍可拖动旋转';
  if (typeof window.DeviceOrientationEvent !== 'function') return '当前设备不支持运动感应，仍可拖动旋转';
  return null;
}

function screenAngle(): number {
  const angle = window.screen.orientation?.angle ?? window.orientation ?? 0;
  return Number.isFinite(angle) ? angle : 0;
}

/** Permission and sensor listeners exist only for this open viewer; intent is never persisted. */
export function useAlbumOrientation(options: AlbumOrientationOptions) {
  const latest = useRef(options); latest.current = options;
  const [intended, setIntended] = useState(false);
  const [status, setStatus] = useState<AlbumOrientationStatus>(() => unavailableReason() ? 'unavailable' : 'idle');
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [angle, setAngle] = useState(screenAngle);
  const neutral = useRef<AlbumOrientationReading | null>(null);
  const alive = useRef(true);
  const request = useRef(0);
  const pending = useRef(false);
  const granted = useRef(false);
  const intention = useRef(false);
  const reducedRef = useRef(reduced);

  const recalibrate = useCallback(() => {
    neutral.current = null;
    latest.current.onTilt(0, 0);
  }, []);

  const disable = useCallback(() => {
    request.current++;
    pending.current = false;
    intention.current = false;
    setIntended(false);
    setStatus(unavailableReason() ? 'unavailable' : 'idle');
    recalibrate();
  }, [recalibrate]);

  const enable = useCallback(async () => {
    if (!alive.current || pending.current) return;
    if (unavailableReason()) {setStatus('unavailable'); return;}
    const ticket = ++request.current;
    if (!granted.current) {
      pending.current = true;
      setStatus('requesting');
      try {
        const Orientation = window.DeviceOrientationEvent as PermissionOrientation;
        // Called synchronously from the button's click, before any await can lose activation.
        const permission = Orientation.requestPermission?.call(Orientation);
        const result = permission ? await permission : 'granted';
        if (!alive.current || request.current !== ticket) return;
        if (result !== 'granted') {setStatus('denied'); return;}
        granted.current = true;
      } catch {
        if (alive.current && request.current === ticket) setStatus('denied');
        return;
      } finally {
        if (request.current === ticket) pending.current = false;
      }
    }
    if (!alive.current || request.current !== ticket) return;
    recalibrate();
    intention.current = true;
    setIntended(true);
  }, [recalibrate]);

  useEffect(() => {
    alive.current = true;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => {
      reducedRef.current = media.matches;
      setReduced(media.matches);
      recalibrate();
    };
    const visibility = () => {setVisible(!document.hidden); recalibrate();};
    const rotation = () => {setAngle(screenAngle()); recalibrate();};
    media.addEventListener('change', preference);
    document.addEventListener('visibilitychange', visibility);
    window.screen.orientation?.addEventListener('change', rotation);
    window.addEventListener('orientationchange', rotation);
    return () => {
      alive.current = false;
      request.current++;
      pending.current = false;
      media.removeEventListener('change', preference);
      document.removeEventListener('visibilitychange', visibility);
      window.screen.orientation?.removeEventListener('change', rotation);
      window.removeEventListener('orientationchange', rotation);
    };
  }, [recalibrate]);

  useEffect(() => {
    const permission = options.permission;
    if (!permission) return;
    let current = true;
    void permission.then(result => {
      if (!current || !alive.current) return;
      if (result !== 'granted') {setStatus(result === 'denied' ? 'denied' : 'unavailable'); return;}
      granted.current = true;
      recalibrate(); intention.current = true; setIntended(true);
    });
    return () => {current = false;};
  }, [options.permission, recalibrate]);

  useEffect(() => {
    if (!intended) return;
    recalibrate();
    if (reduced) {setStatus('reduced-motion'); return;}
    if (!options.active || !visible) {setStatus('paused'); return;}
    let listening = true;
    const initialAngle = screenAngle();
    setStatus('waiting');
    const timeout = window.setTimeout(() => {
      if (listening && alive.current && intention.current && !neutral.current) setStatus('no-signal');
    }, 4000);
    const orientation = (event: DeviceOrientationEvent) => {
      if (!listening || !alive.current || !intention.current || !latest.current.active ||
          document.hidden || reducedRef.current) return;
      const reading = albumOrientationReading(event.beta, event.gamma);
      if (!reading) return;
      // Screen changes can arrive before the orientationchange event on older Safari.
      if (screenAngle() !== initialAngle) {recalibrate(); setAngle(screenAngle()); return;}
      if (!neutral.current) neutral.current = reading;
      const tilt = albumOrientationTilt(reading, neutral.current, initialAngle);
      window.clearTimeout(timeout);
      setStatus('enabled');
      latest.current.onTilt(tilt.x, tilt.y);
    };
    window.addEventListener('deviceorientation', orientation);
    return () => {
      listening = false;
      window.clearTimeout(timeout);
      window.removeEventListener('deviceorientation', orientation);
      neutral.current = null;
    };
  }, [intended, options.active, reduced, visible, angle, recalibrate]);

  const messages: Record<AlbumOrientationStatus, string> = {
    idle: '开启后，轻转手机查看光泽',
    requesting: '等待运动感应授权…',
    waiting: '正在等待运动感应数据…',
    enabled: '轻转手机，查看光泽',
    paused: '运动感应已暂停',
    denied: '未获运动感应权限，仍可拖动旋转',
    unavailable: unavailableReason() ?? '当前浏览器无法启用运动感应，仍可拖动旋转',
    'no-signal': '未收到运动感应数据，仍可拖动旋转',
    'reduced-motion': '减少动态效果已开启，运动感应暂停',
  };
  return {status, message: messages[status], intended, enable, disable, recalibrate};
}
