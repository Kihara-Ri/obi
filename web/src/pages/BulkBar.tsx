// 批量操作条：选中专辑后浮在底部（position:fixed，不挤压页面）。选中清空时先播放退出动画再卸载，
// 退出期间仍显示最后一次的选择，按钮不可点；样式见 BulkBar.css。
// 手机（≤840px）按 iOS 多选的惯例分两处（2026-11-19）：顶栏换成「取消｜已选 N 张｜全选」，
// 底栏换成一行操作条（占底栏原位，不再叠在底栏上方挡住专辑）；操作超过 3 个时其余收进「更多」。
import {useEffect, useRef, useState} from 'react';
import {useApp} from '../state/AppContext';
import {openSaleForm} from '../forms/SaleForm';
import {openShipForm} from '../forms/ShipForm';
import {openJoinShipment} from '../forms/JoinShipmentForm';
import {bulkAction} from '../forms/shared';
import './BulkBar.css';

const LEAVE_MS = 180;   // 与 BulkBar.css 的退出动画时长一致
const INLINE_MAX = 3;   // 手机一行最多放几个操作；再多就留前 2 个 + 「更多」

interface Action { label: string; run: () => void; primary?: boolean }

export function BulkBar({page, ids, allIds, isTrash}: {page: string; ids: string[]; allIds: string[]; isTrash: boolean}) {
  const app = useApp();
  const {modules} = app;
  const show = ids.length > 0 || app.mobileSelecting;
  const [present, setPresent] = useState(show);
  const [more, setMore] = useState(false);
  const last = useRef(ids);
  const barRef = useRef<HTMLDivElement>(null);
  if (show) last.current = ids;

  useEffect(() => {
    if (show) { setPresent(true); return; }
    setMore(false);
    const t = setTimeout(() => setPresent(false), LEAVE_MS);
    return () => clearTimeout(t);
  }, [show]);

  // 「更多」菜单：点到操作条以外的地方就收起
  useEffect(() => {
    if (!more) return;
    const off = (e: PointerEvent) => { if (!barRef.current?.contains(e.target as Node)) setMore(false); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [more]);

  if (!show && !present) return null;
  const sel = show ? ids : last.current;
  const none = sel.length === 0;
  const clear = () => { app.setSelected(new Set()); app.setMobileSelecting(false); };
  const allOn = allIds.length > 0 && sel.length === allIds.length;
  const toggleAll = () => app.setSelected(allOn ? new Set() : new Set(allIds));

  const acts: Action[] = [];
  const add = (label: string, run: () => void, primary = false) => acts.push({label, run, primary});
  if (page === 'overseas') {
    add('✈ 打包运输', () => openShipForm(app, sel), true);
    if (app.state.shipments.some(s => s.status === 'transit')) add('加入已有包裹', () => openJoinShipment(app, sel));
  }
  if (page === 'domestic' && modules.trading) add('合单售出', () => openSaleForm(app, sel), true);
  if ((page === 'overseas' || page === 'domestic') && modules.trading) {
    // 上架 / 下架只对会变的那几张生效：全未上架只给「标记上架」，全已上架只给「取消上架」；
    // 混选时两个都给并写明张数（未上架的排前、进操作条，已上架的进「更多」）。没选时留一个占位。
    const listed = new Set(app.state.records.filter(r => r.listed).map(r => r.id));
    const on = sel.filter(id => listed.has(id)), off = sel.filter(id => !listed.has(id));
    const mixed = on.length > 0 && off.length > 0;
    if (off.length || none) add(mixed ? `上架 ${off.length} 张` : '标记上架', () => bulkAction(app, 'list', off, `已标记上架 ${off.length} 张`));
    if (on.length) add(mixed ? `下架 ${on.length} 张` : '取消上架', () => bulkAction(app, 'unlist', on, `已取消上架 ${on.length} 张`));
  }
  if (page === 'domestic' && modules.circulation) add('调回海外', () => bulkAction(app, 'to_overseas', sel, '已调回海外', {action: 'undo_to_overseas'}));
  if (!isTrash) add('移入回收站', () => bulkAction(app, 'delete', sel, '已移入回收站，可在设置中恢复'));
  else add('恢复专辑', () => bulkAction(app, 'restore', sel));

  const button = (a: Action, extra = '') => (
    <button key={a.label} className={(a.primary ? 'primary' : '') + extra} disabled={none}
            onClick={() => { setMore(false); a.run(); }}>{a.label}</button>
  );
  const inline = acts.length > INLINE_MAX ? acts.slice(0, INLINE_MAX - 1) : acts;
  const rest = acts.slice(inline.length);
  const leaving = show ? '' : ' is-leaving';

  return (
    <>
      <div className={'bulk-top' + leaving} role="toolbar" aria-label="选择">
        <button className="quiet" onClick={clear}>取消</button>
        <strong aria-live="polite">{none ? '选择专辑' : `已选 ${sel.length} 张`}</strong>
        <button className="quiet" onClick={toggleAll} disabled={!allIds.length}>{allOn ? '全不选' : '全选'}</button>
      </div>
      <div ref={barRef} className={'bulkbar' + leaving} role="toolbar" aria-label="批量操作">
        <div className="bulkbar-head">
          <strong>已选 {sel.length} 张</strong>
          <button className="quiet" onClick={clear}>取消</button>
        </div>
        <div className="bulkbar-actions">
          {inline.map(a => button(a))}
          {rest.map(a => button(a, ' is-overflow'))}
          {rest.length ? <button className="bulk-more-btn" aria-expanded={more} aria-haspopup="menu" disabled={none}
                                 onClick={() => setMore(!more)}>更多</button> : null}
        </div>
        {more && rest.length ? <div className="bulk-more" role="menu">
          {rest.map(a => <button key={a.label} role="menuitem" onClick={() => { setMore(false); a.run(); }}>{a.label}</button>)}
        </div> : null}
      </div>
    </>
  );
}
