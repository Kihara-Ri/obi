// 管理页（详情的二级页）：买入信息、备注、商品入口、运输、交易历史及流转。
// 按用户的操作顺序排，不按字段排；流转操作放最底并保留原有的移除确认语义（回收站可恢复）。
import {Chevron} from '../../components/ui/Chevron';
import {useApp} from '../../state/AppContext';
import type {AppCtx} from '../../state/AppContext';
import {fmt, fmtJPY, jpyCost, rmb, shipFeeText, yuan} from '../../core/format';
import {SALE_NAMES} from '../../types';
import {openPurchaseForm} from '../PurchaseForm';
import {Rows} from './Rows';
import {FlowSection} from './FlowSection';

function openListing(url: string, itemId?: string) {
  const {userAgent, platform, maxTouchPoints} = navigator;
  const mobile = /Android|iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  if (!itemId || !mobile) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  // Keep the link out of the long-press hit target, but navigate in the tap's activation.
  const link = document.createElement('a');
  link.href = `https://h5.m.goofish.com/item?id=${encodeURIComponent(itemId)}`;
  link.rel = 'noreferrer';
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
}

export function openManagePage(app: AppCtx, id: string) {
  app.openDrawer({title: '管理', content: <ManageBody id={id}/>,
    // 返回 = 弹栈露出下面那一层详情（它一直挂载着），不是重新打开一个新详情页：不会重新加载
    back: {label: '返回专辑详情', run: () => { app.backDrawer(); }}});
}

function ManageBody({id}: {id: string}) {
  const app = useApp();
  const {modules} = app;
  const r = app.rec(id);
  if (!r) return null;
  const sales = app.state.sales.filter(s => s.items.some(i => i.recordId === id));
  const shipment = r.shipmentId ? app.state.shipments.find(s => s.id === r.shipmentId) : undefined;
  const shipItem = shipment?.items.find(i => i.recordId === id);
  const approx = jpyCost(r);
  const listingUrl = modules.trading ? r.listingUrl : undefined;
  return <div className="detail-page">
    <Rows rows={[{label: '录入时间', value: r.createdAt?.replace('T', ' ') || '未记录'}]}/>
    {modules.acquisition ? <>
      <h3 className="section-title">买入</h3>
      <Rows rows={[
        {label: '金额', value: r.price === '' ? '待补' : <>{r.currency === 'JPY' ? fmtJPY(r.price) + ' 円' : fmt(r.price) + ' 元'}
          {approx ? <> <span className="rmb">{rmb(approx)}</span></> : null}</>},
        {label: '日期', value: r.date || '待补'},
        {label: '渠道', value: r.location || '—'},
        r.currency === 'JPY' && !!r.rate && {label: '当日汇率', value: `100 円 = ¥${Number(r.rate).toFixed(2)}`},
        {label: '额外费用', value: <>{r.fees && Number(r.fees) ? yuan(r.fees) : '—'}
          {shipment?.currency === 'JPY' && shipItem?.feeOriginal
            ? <> <span className="rmb">含国际运费 {fmtJPY(shipItem.feeOriginal)} 円 ≈ {yuan(shipItem.fee)}</span></> : null}</>},
        {label: '折合成本', value: r.cost === null ? '待补' : <b>{yuan(r.cost)}</b>},
      ]}/>
      <button type="button" className="entry-btn" onClick={() => openPurchaseForm(app, id)}>
        编辑买入信息<Chevron dir="right"/></button>
    </> : null}
    {r.note || r.noteAlbum ? <>
      <h3 className="section-title">备注</h3>
      {r.note ? <p className="note-text"><b>这张副本</b>{r.note}</p> : null}
      {r.noteAlbum ? <p className="note-text"><b>这张专辑（所有副本共享）</b>{r.noteAlbum}</p> : null}
    </> : null}
    {listingUrl && /^https?:\/\//i.test(listingUrl) ? (
      <button type="button" className="entry-btn listing-entry" onContextMenu={e => e.preventDefault()}
        onClick={() => openListing(listingUrl, r.xianyuItemId)}>
        {r.xianyuItemId ? '打开闲鱼' : '打开商品网页'}<i aria-hidden="true">↗</i>
      </button>
    ) : null}
    {modules.circulation && shipment && shipment.status !== 'cancelled' ? <>
      <h3 className="section-title">运输</h3>
      <Rows rows={[
        {label: '包裹', value: `${shipment.method} · ${shipment.date} 发货`},
        {label: '状态', value: shipment.arrivedDate ? `已签收 ${shipment.arrivedDate}` : '在途'},
        {label: '运费分摊', value: shipFeeText(shipment.currency, shipItem?.feeOriginal, shipItem?.fee || 0)},
      ]}/>
    </> : null}
    {modules.trading && sales.length ? <>
      <h3 className="section-title">交易历史</h3>
      {sales.map(s => {
        const item = s.items.find(i => i.recordId === id)!;
        return <Rows key={s.id} rows={[
          {label: s.date + ' 售出', value: SALE_NAMES[s.status] + (s.receivedDate ? ` · 到账 ${s.receivedDate}` : '')},
          {label: '到手', value: yuan(item.net)},
          modules.acquisition && item.profit !== null && {label: '利润', value: yuan(item.profit)},
          !!s.address && {label: '地址', value: s.address},
        ]}/>;
      })}
    </> : null}
    <FlowSection r={r}/>
  </div>;
}
