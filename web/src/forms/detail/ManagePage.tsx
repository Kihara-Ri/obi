// 管理页（详情的二级页）：管钱——买入信息（可编辑）、这一张的备注全文、上架、运输、交易历史，以及流转（海外 / 国内库存切换 + 移除）。
// 按用户的操作顺序排，不按字段排；流转操作放最底并保留原有的移除确认语义（回收站可恢复）。
import {Chevron} from '../../components/ui/Chevron';
import {useApp} from '../../state/AppContext';
import type {AppCtx} from '../../state/AppContext';
import {fmt, fmtJPY, jpyCost, rmb, shipFeeText, yuan} from '../../core/format';
import {SALE_NAMES} from '../../types';
import {CopyButton} from '../../components/CopyButton';
import {openListingForm} from '../ListingForm';
import {openPurchaseForm} from '../PurchaseForm';
import {Rows} from './Rows';
import {FlowSection} from './FlowSection';

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
  const inStock = ['overseas', 'domestic'].includes(r.status);
  return <div className="detail-page">
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
    {modules.trading && (inStock || r.listed || r.listingChannel || r.listingUrl || r.listingDescription) ? <>
      <h3 className="section-title">上架</h3>
      <Rows rows={[
        r.listingChannel && {label: '平台', value: r.listingChannel},
        r.listingUrl && {label: '链接', value: <a href={r.listingUrl} target="_blank" rel="noopener noreferrer">打开商品页面 ↗</a>},
      ]}/>
      {r.listingDescription ? <p className="note-text listing-description">{r.listingDescription}
        <CopyButton text={r.listingDescription} label="复制上架描述"/></p> : null}
      {inStock ? <button type="button" className="entry-btn" onClick={() => openListingForm(app, id)}>
        编辑上架资料<Chevron dir="right"/></button> : null}
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
