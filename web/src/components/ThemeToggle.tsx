// 外观切换：iOS 式三段滑块「浅色 ☀ / 深色 ☾ / 跟随系统」，三态平铺点按直达，不再循环。
// 桌面端在页头右上角（compact 紧凑尺寸，手机端隐藏），手机端在「更多 · 管理」行内右侧。
// 偏好读写经 core/theme → static/theme.js。
import type {ReactNode} from 'react';
import {useApp} from '../state/AppContext';
import {Seg} from './ui/Seg';
import {NavRow} from './ui/NavRow';
import type {ThemePref} from '../core/theme';

// 线性图标与登录页同风格（stroke 1.8、圆角端点）
const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
  </svg>
);
const SystemIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="20" height="14" x="2" y="3" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
  </svg>
);

const OPTIONS: {value: ThemePref; ariaLabel: string; icon: ReactNode}[] = [
  {value: 'light', ariaLabel: '浅色', icon: <SunIcon/>},
  {value: 'dark', ariaLabel: '深色', icon: <MoonIcon/>},
  {value: 'system', ariaLabel: '跟随系统', icon: <SystemIcon/>},
];

function ThemeSeg() {
  const {theme, setTheme} = useApp();
  return (
    <Seg className="theme-seg" persistKey="theme" ariaLabel="外观主题"
         options={OPTIONS.map(o => ({value: o.value, label: o.icon, ariaLabel: o.ariaLabel, title: o.ariaLabel}))}
         value={theme} onValue={v => setTheme(v as ThemePref)}/>
  );
}

export function ThemeToggle({withLabel = false}: {withLabel?: boolean}) {
  if (withLabel) return <NavRow icon="◐" title="外观" trailing={<ThemeSeg/>}/>;
  return <ThemeSeg/>;
}
