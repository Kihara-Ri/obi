// Toast：全局消息提示。顶部中间弹出，一条彩线从顶边中点出发沿边框环绕一周，
// 走过的路径变为对应级别的颜色（ok 绿 / warn 黄 / err 红），走完一圈后淡出消失。
// 生命周期由本组件的定时器统一驱动（不再依赖动画结束事件，减少动态效果下也一样可靠）：
//   · 停留时长按级别区分——错误要让人读完，所以比成功久；
//   · 鼠标悬停或键盘聚焦时暂停计时与动画，移开后接着走；
//   · 点一下立即关闭；
//   · 错误用 role=alert（读屏立即朗读），其余 role=status。
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {CSSProperties} from 'react';
import type {ToastAction, ToastKind} from '../../../state/AppContext';
import './Toast.css';

/** 各级别环绕一周（即停留）的时长，毫秒 */
const SHOW_MS: Record<ToastKind, number> = {ok: 2000, warn: 3500, err: 6000};
/** 带操作按钮的 toast 停留时长，给用户足够时间反应 */
const ACTION_MS = 8000;
/** 淡出：延迟 .25s + 动画 .22s，与 Toast.css 的 toast-out 保持一致 */
const LEAVE_MS = 470;

const RADIUS = 14;   // 与 #toast 的 border-radius 保持一致
const INSET = 1.25;  // 描边宽 2.5，路径内缩一半让线正好压住 1px 边框

// 圆角矩形路径，起笔在顶边中点、顺时针绕行回到起点——
// 不用 <rect>：rect 的描边起笔在左上圆弧后，dash 在闭合路径上不绕回，
// 起点左侧那段永远补不上。pathLength=100 后 dasharray 0→100 即整圈。
function ringPath(width: number, height: number): string {
  const i = INSET, x = i, y = i, w = width - i * 2, h = height - i * 2;
  const r = Math.min(RADIUS, w / 2, h / 2);
  const cx = x + w / 2;
  return 'M ' + cx + ' ' + y
    + ` H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r}`
    + ` V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`
    + ` H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r}`
    + ` V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y}`
    + ` H ${cx}`;
}

export interface ToastProps {
  kind: ToastKind;
  text: string;
  /** 可选操作按钮（如「撤销」）；点击后执行并立即关闭，停留时间延长到 8 秒 */
  action?: ToastAction;
  onDone: () => void;
}

export function Toast({kind, text, action, onDone}: ToastProps) {
  const box = useRef<HTMLDivElement>(null);
  const [d, setD] = useState('');
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

  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !el.clientWidth) return;
    setD(ringPath(el.clientWidth, el.clientHeight));
  }, [text]);

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
    <div id="toast" className={kind + (leaving ? ' leaving' : '')} ref={box}
         role={kind === 'err' ? 'alert' : 'status'} aria-live={kind === 'err' ? 'assertive' : 'polite'}
         data-paused={paused || undefined} style={{'--toast-ms': `${showMs}ms`} as CSSProperties}
         onPointerEnter={pause} onPointerLeave={resume} onFocus={pause} onBlur={resume}
         onClick={() => { if (phase.current === 'show') { window.clearTimeout(timer.current); leave(); } }}>
      <svg className="toast-ring" aria-hidden="true">
        {d ? <path d={d} pathLength="100"/> : null}
      </svg>
      {text}
      {action ? <button type="button" className="toast-action"
                        onClick={e => { e.stopPropagation(); window.clearTimeout(timer.current); leave(); action.run(); }}>{action.label}</button> : null}
    </div>
  );
}
