// Collapse：内容区平滑展开 / 收起（高度 + 淡入）。受控：open。
// 收起时内容 inert（不可聚焦、不被读屏读到），但保持挂载，所以输入框里的内容不会丢。
import type {ReactNode} from 'react';
import './Collapse.css';

export interface CollapseProps {
  open: boolean;
  children: ReactNode;
  id?: string;
  className?: string;
}

export function Collapse({open, children, id, className = ''}: CollapseProps) {
  return (
    <div id={id} className={`collapse${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`} inert={!open}>
      <div className="collapse-inner">{children}</div>
    </div>
  );
}
