// ShipmentStack：包裹内专辑的「摞起来」预览 + 展开成列表的开关。
// 默认收起（一摞封面，最多 5 张，余数用 +N 表示），点击整摞或右侧按钮展开；展开后列表由调用方作为 children 提供。
// 状态靠形状区分：收起是叠放封面，展开是列表且按钮箭头朝上；不要在这里放金额或操作。
import {useId, useState, type ReactNode} from 'react';
import type {AlbumRecord} from '../../types';
import {Cover} from '../Cover';
import {Collapse} from '../ui/Collapse';
import {Chevron} from '../ui/Chevron';
import './ShipmentStack.css';

const MAX_LAYERS = 5;

export function ShipmentStack({records, children}: {records: AlbumRecord[]; children: ReactNode}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!records.length) return null;
  const shown = records.slice(0, MAX_LAYERS);
  const rest = records.length - shown.length;
  return (
    <div className={`ship-stack${open ? ' is-open' : ''}`}>
      <button type="button" className="ship-stack-toggle" aria-expanded={open} aria-controls={panelId}
        aria-label={open ? '收起专辑列表' : `展开 ${records.length} 张专辑`} onClick={() => setOpen(o => !o)}>
        <span className="ship-stack-pile" aria-hidden="true">
          {shown.map((r, i) => (
            <span key={r.id} className="ship-stack-layer" style={{'--i': i, '--n': shown.length} as React.CSSProperties}>
              <Cover r={r}/>
            </span>
          ))}
        </span>
        <span className="ship-stack-count">{rest > 0 ? `+${rest}` : ''}</span>
        <Chevron className="ship-stack-chev" open={open}/>
      </button>
      <Collapse id={panelId} open={open}>{children}</Collapse>
    </div>
  );
}
