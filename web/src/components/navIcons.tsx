// 手机底栏图标：统一 24 栅格、1.8 描边、圆角端点，颜色随文字（currentColor）。
import type {ReactNode} from 'react';

const Svg = ({children}: {children: ReactNode}) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>);

const ICONS: Record<string, ReactNode> = {
  // 展示：错落的画框
  gallery: <><rect x="3.5" y="3.5" width="7.5" height="9" rx="1.8"/><rect x="13" y="3.5" width="7.5" height="5.5" rx="1.8"/>
    <rect x="13" y="11" width="7.5" height="9.5" rx="1.8"/><rect x="3.5" y="14.5" width="7.5" height="6" rx="1.8"/></>,
  // 库存：一摞唱片套
  domestic: <><path d="M4 17.5h16"/><path d="M5.5 13h13"/><rect x="3.5" y="5" width="17" height="14.5" rx="2.4"/><path d="M8 9h8"/></>,
  // 在途：纸飞机
  transit: <><path d="M21 3.5 10.2 14"/><path d="M21 3.5 14.5 20.5l-4.3-6.5L3.5 9.8z"/></>,
  // 售出中：打包的方盒 + 向外箭头
  shipping: <><path d="M20.5 8.2v8.3a2 2 0 0 1-1 1.7l-6.5 3.7a2 2 0 0 1-2 0L4.5 18.2a2 2 0 0 1-1-1.7V8.2"/>
    <path d="M3.7 7.4 12 12l8.3-4.6M12 12v9.4"/></>,
  more: <><circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/></>,
};

export function NavIcon({name}: {name: string}) { return <Svg>{ICONS[name] ?? ICONS.more}</Svg>; }
