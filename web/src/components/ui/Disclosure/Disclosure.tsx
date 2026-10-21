// Disclosure：把说明性文字默认收起，需要时点开（基于 Details，带展开动画）。
// 产品界面讲究少字：解释放这里，主界面只留控件、数字和状态。
import type {ReactNode} from 'react';
import {Details} from '../Details';
import './Disclosure.css';

export interface DisclosureProps {
  /** 收起时显示的文字，默认「说明」 */
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Disclosure({summary = '说明', children, className = ''}: DisclosureProps) {
  return (
    <Details className={`disclosure${className ? ` ${className}` : ''}`} summary={summary}>
      <div className="disclosure-body">{children}</div>
    </Details>
  );
}
