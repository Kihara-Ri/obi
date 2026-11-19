// 售出中与已交易共用销售单卡片：专辑、金额与操作集中展示。
// 2026-11-17 收紧：售出中用「已 N 天」徽标代替状态标签（久等变提醒色）；费用明细收成一行；
// 售出中只露「修改费用」「确认收货」（2026-11-19：修改费用最常用，换到外面），「退款 / 退货」「撤销售出」收进「⋯」；单张不写「1 张」。
import type {ReactNode} from 'react';
import {useApp} from '../state/AppContext';
import type {AppCtx} from '../state/AppContext';
import type {Sale} from '../types';
import {SALE_NAMES} from '../types';
import {daysSince, shipFeeText, sum, yuan} from '../core/format';
import {AlbumSummary} from '../components/AlbumSummary';
import {ShopMark} from '../components/ShopField';
import {MoreIco, RefundIco, UndoIco} from '../components/icons';
import {openDetail} from '../forms/DetailDrawer';
import {CONFIRM_TITLES, ConfirmForm} from '../forms/ConfirmForm';

/** 售出中超过这么多天还没确认收货，天数徽标变提醒色 */
export const LONG_WAIT_DAYS = 7;

function openConfirm(app: AppCtx, kind: keyof typeof CONFIRM_TITLES,
                    opts: {id?: string; sale?: Sale; arriveCount?: number} = {}) {
  app.openDrawer({title: CONFIRM_TITLES[kind], asForm: true, compact: true,
    content: <ConfirmForm kind={kind} id={opts.id} sale={opts.sale} arriveCount={opts.arriveCount}/>});
}

// 「⋯」更多操作：贴底操作单，标题写明是哪一笔；每项「图标 + 名称 + 一句说明」，
// 选一项后在抽屉栈里推入对应表单（取消回到这里）
function openSaleMore(app: AppCtx, s: Sale) {
  const first = app.rec(s.items[0]?.recordId ?? '')?.title || '这笔交易';
  const row = (ico: ReactNode, label: string, hint: string, run: () => void, cls = '') => (
    <button type="button" className={cls} onClick={run}>{ico}<span><b>{label}</b><small>{hint}</small></span></button>);
  app.openDrawer({title: s.items.length > 1 ? `${first} 等 ${s.items.length} 张` : first, compact: true, content: (
    <div className="sale-more">
      {row(RefundIco, '退款 / 退货', '买家退款，或专辑退回到国内库存', () => openConfirm(app, 'refund', {id: s.id, sale: s}))}
      {row(UndoIco, '撤销售出', '记错了或没成交，专辑回到原状态', () => openConfirm(app, 'cancel', {id: s.id}), 'danger')}
    </div>)});
}

// 完整销售单；多张合单仍按独立副本展示。
export function SaleCard({s, onArtist, onEditCosts}: {s: Sale; onArtist: (artist: string) => void; onEditCosts: () => void}) {
  const app = useApp();
  const unknown = s.items.some(i => i.profit === null);
  const net = sum(s.items, 'net');
  const profit = sum(s.items, 'profit');
  const shipping = s.status === 'shipping';
  const days = daysSince(s.date);
  const badge = shipping
    ? <span className={'pill wait-days' + (days > LONG_WAIT_DAYS ? ' is-long' : '')}
            title={days > LONG_WAIT_DAYS ? '等待较久，可以催买家确认收货' : undefined}>已 {days} 天</span>
    : <span className={`pill ${s.status === 'complete' ? 'sold' : 'pending-pill'}`}>{s.unshipped ? '未发货退款' : SALE_NAMES[s.status]}</span>;
  const info = [
    `${s.date} 售出`,
    !shipping && s.receivedDate ? `到账 ${s.receivedDate}` : '',
    s.orderId ? `单 ${s.orderId}` : '', s.address || '',
  ].filter(Boolean);
  const count = [s.items.length > 1 ? `${s.items.length} 张` : '', s.note || ''].filter(Boolean).join(' · ');
  return (
    <article className="sale-card">
      <div className="sale-top">
        {badge}
        <span className="when info">
          {/* 售出平台用品牌图标（与买入渠道同一套 ShopMark），读屏与长按悬停仍给出平台名 */}
          {s.channel ? <span className="sale-channel" role="img" aria-label={`平台 ${s.channel}`} title={s.channel}><ShopMark name={s.channel}/></span> : null}
          {/* 每项整体不断开（单号不会被拆成两行），只在「 · 」处折行 */}
          {info.map((x, k) => <span key={k}>{k ? ' · ' : ''}<span className="nowrap">{x}</span></span>)}
        </span>
        <span className="spacer"/>
        {count ? <span className="when count">{count}</span> : null}
      </div>
      <div className="sale-items">
        {s.items.map(i => {
          const r = app.rec(i.recordId);
          if (!r) return null;
          return (
            <AlbumSummary key={i.recordId} r={r} onDetail={() => openDetail(app, r.id)} onArtist={onArtist} money={<>
              {app.modules.acquisition ? <small>{r.cost === null ? '成本待补' : `成本 ${yuan(r.cost)}`}</small> : null}
              <div className="album-money-main">
                <small>{shipping ? '预计到手' : '到手'}</small>
                <b>{yuan(i.net)}</b>
                {app.modules.acquisition ? i.profit !== null
                  ? <small className={Number(i.profit) < 0 ? 'negative' : 'positive'}>
                    {shipping ? '预估利润' : '利润'} {yuan(i.profit)}
                  </small>
                  : <small>利润待补</small> : null}
              </div>
            </>}/>
          );
        })}
      </div>
      <div className="sale-foot">
        {/* 费用明细一行：到手价与利润已在右侧，这里只交代怎么算出来 */}
        <p className="sale-fees">
          {/* 每项整体不断开，项与项之间的空格留在外面作折行点（日元带折算时一行放不下） */}
          <span>成交 {shipFeeText(s.currency, s.grossOriginal, s.gross)}</span>{' '}
          <span>− 扣费 {shipFeeText(s.currency, s.feesOriginal, s.fees)}</span>{' '}
          <span>− 运费 {shipFeeText(s.currency, s.postageOriginal, s.postage || '0')}</span>
        </p>
        {s.items.length > 1 ? <div className="cell total"><span>{shipping ? '预计到手合计' : '到手合计'}</span><b>{yuan(net)}</b></div> : null}
        {s.items.length > 1 && app.modules.acquisition ? <div className="cell total">
          <span>{shipping ? '预估利润' : '利润'}</span>
          <b className={unknown ? '' : Number(profit) < 0 ? 'negative' : 'positive'}>
            {unknown ? '待补' : yuan(profit)}
          </b>
        </div> : null}
        <span className="spacer"/>
        {shipping && (
          <div className="actions">
            <button className="sale-more-btn" aria-label="更多操作" title="更多操作"
                    onClick={() => openSaleMore(app, s)}>{MoreIco}</button>
            <button onClick={onEditCosts}>修改费用</button>
            <button className="primary" onClick={() => openConfirm(app, 'receive', {id: s.id, sale: s})}>确认收货</button>
          </div>
        )}
        {s.status === 'complete' && (
          <div className="actions"><button onClick={onEditCosts}>修改费用</button></div>
        )}
        {(s.status === 'refunded' || s.status === 'returned') && (
          <div className="actions">
            <button className="quiet" onClick={() => openConfirm(app, 'undo_refund', {id: s.id, sale: s})}>撤销退款</button>
          </div>
        )}
      </div>
    </article>
  );
}

export {openConfirm};
