// Splash：启动加载画面 + 进入主界面的转场。唱片在加载时匀速转动；
// ready 后反光缓动减速到停、沿水平中线裂成上下两半分开，主界面从中心以圆形孔洞扩散露出
// 并轻微放大淡入，两半唱片飞出屏幕。加载得很快（<SHOW_DELAY）整个画面都不出现；
// 出现后至少停留 MIN_SHOW；超过 SLOW_AFTER 仍未就绪改提示网络较慢。
// index.html 里有一份同样外观的静态占位（#boot-splash），JS 还在下载时就有画面，
// React 接手后无缝替换。减少动态效果下只做淡出。
import {useEffect, useRef, useState} from 'react';
import './Splash.css';

const SHOW_DELAY = 150;   // 比这更快就绪：不显示加载画面
const MIN_SHOW = 500;     // 显示后至少停留，转场才有机会被看清
const SLOW_AFTER = 8000;  // 加载超过这么久换成「网络较慢」提示
const EXIT_MS = 720;      // 与 Splash.css 退场动画总时长一致
const ENTER_MS = 800;     // html.splash-enter 的保留时长（主界面入场动画）

export interface SplashProps {
  /** 数据就绪。变为 true 后播放退场并自行卸载 */
  ready: boolean;
}

type Phase = 'wait' | 'show' | 'exit' | 'gone';

/** 反光层当前旋转角（度）。退场时接着这个角度缓动减速，而不是硬停。
 *  伪元素的 computed transform 不一定随动画更新，所以直接按动画进度换算（线性、一圈 360°） */
function glintAngle(root: HTMLElement | null): number {
  const el = root?.querySelector('.splash-half');
  const anim = el?.getAnimations({subtree: true}).find(a => (a as CSSAnimation).animationName === 'vinyl-glint');
  const dur = Number(anim?.effect?.getComputedTiming().duration);
  const t = Number(anim?.currentTime);
  return dur > 0 && Number.isFinite(t) ? (t % dur) / dur * 360 : 0;
}

export function Splash({ready}: SplashProps) {
  const boot = useRef(typeof document !== 'undefined' && !!document.getElementById('boot-splash'));
  // 有静态占位时以页面导航起点计时（占位从那时起就在倒计时显示）
  const born = useRef(boot.current ? 0 : performance.now());
  const elapsed = performance.now() - born.current;
  const [phase, setPhase] = useState<Phase>(ready ? 'gone' : elapsed >= SHOW_DELAY ? 'show' : 'wait');
  const [slow, setSlow] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== 'wait') return;
    if (ready) { setPhase('gone'); return; }   // 极速就绪：从未显示
    const t = window.setTimeout(() => setPhase('show'), Math.max(0, SHOW_DELAY - (performance.now() - born.current)));
    return () => window.clearTimeout(t);
  }, [phase, ready]);

  useEffect(() => {
    if (phase !== 'show') return;
    if (!ready) {
      const t = window.setTimeout(() => setSlow(true), Math.max(0, SLOW_AFTER - (performance.now() - born.current)));
      return () => window.clearTimeout(t);
    }
    const shownFor = performance.now() - born.current - SHOW_DELAY;
    const t = window.setTimeout(() => {
      root.current?.style.setProperty('--glint-a0', `${glintAngle(root.current)}deg`);
      setPhase('exit');
    }, Math.max(0, MIN_SHOW - shownFor));
    return () => window.clearTimeout(t);
  }, [phase, ready]);

  useEffect(() => {
    if (phase !== 'exit') return;
    const html = document.documentElement;
    html.classList.add('splash-enter');
    const t1 = window.setTimeout(() => setPhase('gone'), EXIT_MS + 60);
    const t2 = window.setTimeout(() => html.classList.remove('splash-enter'), ENTER_MS);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); html.classList.remove('splash-enter'); };
  }, [phase]);

  if (phase === 'gone') return null;
  // 两半唱片同时挂载、同步起转：反光层相位一致，裂开时纹理不错位
  return (
    <div ref={root} className={`splash is-${phase}${boot.current ? ' no-intro' : ''}`}
         role={phase === 'exit' ? undefined : 'status'} aria-label="加载中">
      <div className="splash-veil"/>
      <div className="splash-disc" aria-hidden="true">
        <div className="vinyl splash-half splash-top"><i className="vinyl-hole"/></div>
        <div className="vinyl splash-half splash-bottom"><i className="vinyl-hole"/></div>
      </div>
      <p className="splash-text">{slow ? '网络较慢，仍在连接…' : '加载中'}</p>
    </div>
  );
}
