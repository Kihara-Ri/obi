// 管理页（详情的二级页）：买入信息、备注、上架状态与链接、运输、交易历史及流转。
// 按用户的操作顺序排，不按字段排；流转操作放最底并保留原有的移除确认语义（回收站可恢复）。
import {Chevron} from '../../components/ui/Chevron';
import {ShopMark} from '../../components/ShopField';
import {useApp} from '../../state/AppContext';
import type {AppCtx} from '../../state/AppContext';
import {fmt, fmtJPY, jpyCost, rmb, shipFeeText, yuan} from '../../core/format';
import {SALE_NAMES} from '../../types';
import {openPurchaseForm} from '../PurchaseForm';
import {openListingForm} from '../ListingForm';
import {Rows} from './Rows';
import {FlowSection} from './FlowSection';

function isMobile() {
  const {userAgent, platform, maxTouchPoints} = navigator;
  return /Android|iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

function openXianyuItem(itemId: string) {
  // 在点按手势内交给系统。隐藏链接让长按时只有按钮可交互。
  const link = document.createElement('a');
  link.href = `fleamarket://awesome_detail?id=${encodeURIComponent(itemId)}&flutter=true`;
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
  const mobileItemId = r.listed && r.listingUrl && isMobile() ? r.xianyuItemId : undefined;
  const sales = app.state.sales.filter(s => s.items.some(i => i.recordId === id));
  const shipment = r.shipmentId ? app.state.shipments.find(s => s.id === r.shipmentId) : undefined;
  const shipItem = shipment?.items.find(i => i.recordId === id);
  const approx = jpyCost(r);
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
    {modules.trading ? <>
      <h3 className="section-title">上架</h3>
      <Rows rows={[
        {label: '状态', value: r.listed ? '已上架' : '未上架'},
        r.listed && {label: '平台', value: r.listingChannel ? <>
          <span className="shop-mark-inline" aria-hidden="true"><ShopMark name={r.listingChannel}/></span>
          <span>{r.listingChannel}</span>
        </> : '未记录'},
        r.listed && {label: '链接', value: !r.listingUrl ? '未记录' : mobileItemId ? (
          <button type="button" className="listing-entry" onContextMenu={e => e.preventDefault()}
            onClick={() => openXianyuItem(mobileItemId)}>打开商品页面 ↗</button>
        ) : <a href={r.listingUrl} target="_blank" rel="noopener noreferrer">打开商品页面 ↗</a>},
      ]}/>
      {r.listed && ['overseas', 'domestic'].includes(r.status) ? (
        <button type="button" className="entry-btn" onClick={() => openListingForm(app, [id], {edit: true, back: '返回管理'})}>
          编辑上架信息<Chevron dir="right"/></button>
      ) : null}
    </> : null}
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
