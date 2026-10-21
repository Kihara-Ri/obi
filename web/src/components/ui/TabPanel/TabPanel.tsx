// TabPanel：标签页内容区。标签切换时内容按切换方向轻微滑入并淡入（往右边的标签 → 内容从右侧来），
// 而不是瞬间替换；首次渲染不播动画。与 Seg 配合：<Seg value={tab}/> + <TabPanel value={tab} order={[...]}>。
// 动画用统一的 --slide-ms / --slide-ease；减少动态效果时由全局规则关闭。
import {useState} from 'react';
import type {CSSProperties, ReactNode} from 'react';
import './TabPanel.css';

export interface TabPanelProps {
  /** 当前标签的值 */
  value: string;
  /** 全部标签的值，按左到右的顺序；用来判断切换方向 */
  order: string[];
  children: ReactNode;
  /** 嵌套使用（如地区 + 视图两层）时，内层设 plain 以免出现多个 tabpanel 角色 */
  plain?: boolean;
}

export function TabPanel({value, order, children, plain}: TabPanelProps) {
  const [prev, setPrev] = useState(value);
  const [dir, setDir] = useState<1 | -1>(1);
  const [switched, setSwitched] = useState(false);
  // 渲染期间根据 value 变化推导方向（React 推荐的「由 props 派生 state」写法）
  if (prev !== value) {
    const from = order.indexOf(prev), to = order.indexOf(value);
    setPrev(value);
    // 有一侧不在 order 里（如换到别的整页）：不播，整页过渡另有处理
    if (from >= 0 && to >= 0) { setDir(to >= from ? 1 : -1); setSwitched(true); } else setSwitched(false);
  }
  return (
    <div key={value} className={`tab-panel${switched ? ' is-switching' : ''}`} role={plain ? undefined : 'tabpanel'}
         style={{'--dir': dir} as CSSProperties}>{children}</div>
  );
}
