import {openArtistDrawer} from '../forms/ArtistDrawer';
// 售出中页：按销售单合并展示专辑、金额与整单操作。
import {daysSince, sum, yuan} from '../core/format';
import {oldestFirst} from '../core/queue-order';
import {useApp} from '../state/AppContext';
import {PageHead} from '../components/PageHead';
import {LONG_WAIT_DAYS, SaleCard} from './SaleCard';
import {openSaleCostsForm} from '../forms/SaleCostsForm';

export function ShippingPage() {
  const app = useApp();
  const {state, modules} = app;
  const rs = state.records.filter(r => r.status === 'shipping');
  // 待办队列：等得最久的在最上面（售出日期从旧到新，同日按记录先后）；历史类列表（交易记录）才是新的在上
  const sales = oldestFirst(state.sales.filter(s => s.status === 'shipping'));
  const items = sales.flatMap(s => s.items);
  const ks = items.filter(i => i.profit !== null);
  const longWait = sales.filter(s => daysSince(s.date) > LONG_WAIT_DAYS).length;

  return (
    <div className="align-list">
      <PageHead title="售出中" label="SELLING"/>
      {/* 统计卡片：两个大数字（预计到手、预估利润），下面一行说明笔数与需要处理的事（久等、成本待补） */}
      <div className="summary sale-summary">
        <div className="sale-metric">
          <span>预计到手</span>
          <strong>{yuan(sum(items, 'net'))}</strong>
        </div>
        {modules.acquisition ? <div className="sale-metric">
          <span>预估利润</span>
          <strong className={ks.length ? (sum(ks, 'profit') < 0 ? 'negative' : 'positive') : ''}>{ks.length ? yuan(sum(ks, 'profit')) : '—'}</strong>
        </div> : null}
        <p className="sale-summary-note">
          <span>{sales.length} 笔待确认收货{rs.length !== sales.length ? ` · 共 ${rs.length} 张` : ''}</span>
          {longWait ? <span className="is-long">{longWait} 笔已超过 {LONG_WAIT_DAYS} 天</span> : null}
          {modules.acquisition && items.length - ks.length ? <span>{items.length - ks.length} 张成本待补</span> : null}
        </p>
      </div>
      {sales.length ? (
        <div id="sales-list">
          {sales.map(s => <SaleCard key={s.id} s={s} onArtist={name => openArtistDrawer(app, name)} onEditCosts={() => openSaleCostsForm(app, s)}/>)}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-symbol">◨</div>
          <h3>没有售出中的专辑</h3>
          <p>在{modules.circulation ? '国内库存' : '我的收藏'}点击「记录售出」后，专辑会在这里等待买家签收。</p>
          <a className="link-button" href="#domestic">查看{modules.circulation ? '国内库存' : '我的收藏'}</a>
        </div>
      )}
    </div>
  );
}
