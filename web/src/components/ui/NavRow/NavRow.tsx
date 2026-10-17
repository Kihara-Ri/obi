// NavRow：导航列表行 = 图标 + 标题 + 右侧数值 + 箭头，一行一件事，没有副标题。
// 三种形态：有 href → 链接；有 onClick → 按钮；都没有 → 静态行，右侧可放 trailing（如分段控件）。
// value 是右侧的数字或状态（图形/数字优先于文字）；trailing 与 value 二选一，trailing 优先。
import type {ReactNode} from 'react';
import './NavRow.css';

export interface NavRowProps {
  icon: ReactNode;
  title: ReactNode;
  /** 右侧的数字或简短状态 */
  value?: ReactNode;
  /** 右侧自定义控件（出现时不再显示 value 与箭头） */
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** 链接目标的可访问名称（title 里是图标/数字混排时使用） */
  ariaLabel?: string;
}

export function NavRow({icon, title, value, trailing, href, onClick, ariaLabel}: NavRowProps) {
  const interactive = Boolean(href || onClick);
  const body = <>
    <span className="nav-row-icon" aria-hidden="true">{icon}</span>
    <span className="nav-row-title">{title}</span>
    {trailing ?? <>
      {value !== undefined && value !== null && value !== '' ? <span className="nav-row-value">{value}</span> : null}
      {interactive ? <span className="nav-row-arrow" aria-hidden="true">›</span> : null}
    </>}
  </>;
  if (href) return <a className="nav-row" href={href} aria-label={ariaLabel}>{body}</a>;
  if (onClick) return <button type="button" className="nav-row" onClick={onClick} aria-label={ariaLabel}>{body}</button>;
  return <div className="nav-row">{body}</div>;
}
