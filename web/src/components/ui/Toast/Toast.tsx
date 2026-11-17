// Toast：全局消息提示。顶部中间弹出的毛玻璃胶囊，左侧实心圆点 + 符号标明级别（ok ✓ / warn ! / err ×）。
// 生命周期由本组件的定时器统一驱动（不依赖动画结束事件，减少动态效果下也一样可靠）：
//   · 停留时长按级别区分——错误要让人读完，所以比成功久；
//   · 鼠标悬停或键盘聚焦时暂停计时，移开后接着走；
//   · 点一下立即关闭；
//   · 错误用 role=alert（读屏立即朗读），其余 role=status。
import {useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import type {ToastAction, ToastKind} from '../../../state/AppContext';
import './Toast.css';

/** 各级别停留时长，毫秒 */
const SHOW_MS: Record<ToastKind, number> = {ok: 2000, warn: 3500, err: 6000};
/** 带操作按钮的 toast 停留时长，给用户足够时间反应 */
const ACTION_MS = 8000;
/** 淡出时长，与 Toast.css 的 toast-out 保持一致 */
const LEAVE_MS = 220;

const glyph = (children: ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>;
const ICONS: Record<ToastKind, ReactNode> = {
  ok: glyph(<polyline points="5 12.5 10 17.5 19 7"/>),
  warn: glyph(<><line x1="12" y1="6" x2="12" y2="13.5"/><line x1="12" y1="18" x2="12" y2="18"/></>),
  err: glyph(<><line x1="7" y1="7" x2="17" y2="17"/><line x1="17" y1="7" x2="7" y2="17"/></>),
};

export interface ToastProps {
  kind: ToastKind;
  text: string;
  /** 可选操作按钮（如「撤销」）；点击后执行并立即关闭，停留时间延长到 8 秒 */
  action?: ToastAction;
  onDone: () => void;
}

export function Toast({kind, text, action, onDone}: ToastProps) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const showMs = action ? ACTION_MS : SHOW_MS[kind];

  // 计时器：left = 当前阶段剩余毫秒，step = 到点要做的事；暂停时记下剩余，恢复后接着走
  const timer = useRef(0);
  const left = useRef(showMs);
  const startedAt = useRef(0);
  const step = useRef<() => void>(() => {});
  const phase = useRef<'show' | 'leave'>('show');
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const arm = (ms: number) => {
    window.clearTimeout(timer.current);
    left.current = ms;
    startedAt.current = performance.now();
    timer.current = window.setTimeout(() => step.current(), ms);
  };
  const leave = () => {
    phase.current = 'leave';
    setLeaving(true);
    step.current = () => doneRef.current();
    arm(LEAVE_MS);
  };

  useEffect(() => {
    step.current = leave;
    arm(showMs);
    return () => window.clearTimeout(timer.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = () => {
    if (phase.current !== 'show') return;
    window.clearTimeout(timer.current);
    left.current = Math.max(0, left.current - (performance.now() - startedAt.current));
    setPaused(true);
  };
  const resume = () => {
    if (phase.current !== 'show') return;
    setPaused(false);
    arm(left.current);
  };

  return (
    <div id="toast" className={kind + (leaving ? ' leaving' : '')}
         role={kind === 'err' ? 'alert' : 'status'} aria-live={kind === 'err' ? 'assertive' : 'polite'}
         data-paused={paused || undefined} data-ms={showMs}
         onPointerEnter={pause} onPointerLeave={resume} onFocus={pause} onBlur={resume}
         onClick={() => { if (phase.current === 'show') { window.clearTimeout(timer.current); leave(); } }}>
      <span className="toast-ico">{ICONS[kind]}</span>
      <span className="toast-text">{text}</span>
      {action ? <button type="button" className="toast-action"
                        onClick={e => { e.stopPropagation(); window.clearTimeout(timer.current); leave(); action.run(); }}>{action.label}</button> : null}
    </div>
  );
}
