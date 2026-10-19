// 批量操作条：选中专辑后浮在底部（position:fixed，不挤压页面）。选中清空时先播放退出动画再卸载，
// 退出期间仍显示最后一次的选择，按钮不可点；样式见 styles/selection.css。
import {useEffect, useRef, useState} from 'react';
import {useApp} from '../state/AppContext';
import {openSaleForm} from '../forms/SaleForm';
import {openShipForm} from '../forms/ShipForm';
import {bulkAction} from '../forms/shared';
import './BulkBar.css';

const LEAVE_MS = 180;   // 与 selection.css 的退出动画时长一致

export function BulkBar({page, ids, isTrash}: {page: string; ids: string[]; isTrash: boolean}) {
  const app = useApp();
  const {modules} = app;
  const show = ids.length > 0;
  const [present, setPresent] = useState(show);
  const last = useRef(ids);
  if (show) last.current = ids;

  useEffect(() => {
    if (show) { setPresent(true); return; }
    const t = setTimeout(() => setPresent(false), LEAVE_MS);
    return () => clearTimeout(t);
  }, [show]);

  if (!show && !present) return null;
  const sel = show ? ids : last.current;
  const clear = () => { app.setSelected(new Set()); app.setMobileSelecting(false); };

  return (
    <div className={show ? 'bulkbar' : 'bulkbar is-leaving'} role="toolbar" aria-label="批量操作">
      <div className="bulkbar-head">
        <strong>已选 {sel.length} 张</strong>
        <button className="quiet" onClick={clear}>取消</button>
      </div>
      <div className="bulkbar-actions">
        {page === 'overseas' ? (
          <>
            <button className="primary" onClick={() => openShipForm(app, sel)}>✈ 打包运输</button>
            {modules.trading ? <><button onClick={() => bulkAction(app, 'list', sel, '已标记上架')}>标记上架</button>
            <button onClick={() => bulkAction(app, 'unlist', sel, '已取消上架')}>取消上架</button></> : null}
          </>
        ) : null}
        {page === 'domestic' ? (
          <>
            {modules.trading ? <><button className="primary" onClick={() => openSaleForm(app, sel)}>合单售出</button>
            <button onClick={() => bulkAction(app, 'list', sel, '已标记上架')}>标记上架</button>
            <button onClick={() => bulkAction(app, 'unlist', sel, '已取消上架')}>取消上架</button></> : null}
            {modules.circulation ? <button onClick={() => bulkAction(app, 'to_overseas', sel)}>调回海外</button> : null}
          </>
        ) : null}
        {!isTrash
          ? <button onClick={() => bulkAction(app, 'delete', sel, '已移入回收站，可在设置中恢复')}>移入回收站</button>
          : <button onClick={() => bulkAction(app, 'restore', sel)}>恢复专辑</button>}
      </div>
    </div>
  );
}
