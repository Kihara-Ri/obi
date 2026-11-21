import {openArtistDrawer} from '../forms/ArtistDrawer';
// 海外在途页：在途包裹 + 最近签收（可回滚）。
import {sum, yuan} from '../core/format';
import {oldestFirst} from '../core/queue-order';
import {useApp} from '../state/AppContext';
import {PageHead} from '../components/PageHead';
import {ShipmentCard} from './ShipmentCard';
import {useRef} from 'react';
import {destOfStatus, useListFlip} from './useListFlip';

export function TransitPage() {
  const app = useApp();
  const {state} = app;
  // 在途是待办：发出最早的在最上面（发出日期从旧到新，同日按记录先后）；下面的「最近签收」是历史，新的在上
  const shs = oldestFirst(state.shipments.filter(s => s.status === 'transit'));
  const arrived = state.shipments.filter(s => s.status === 'arrived')
    .sort((a, b) => (b.arrivedDate || '').localeCompare(a.arrivedDate || ''))
    .slice(0, 6);
  const albumCount = shs.flatMap(s => s.items).length;
  // 签收 → 封面飞向国内库存、包裹挪到「最近签收」；回滚签收 → 包裹挪回在途；撤销运输 → 封面飞回海外库存
  const pageRef = useRef<HTMLDivElement>(null);
  const shipDest = (id: string) => {
    const sh = state.shipments.find(s => s.id === id);
    return destOfStatus(sh?.status === 'transit' ? 'transit' : app.rec(sh?.items[0]?.recordId ?? '')?.status);
  };
  useListFlip(pageRef, `${shs.map(s => s.id)}|${arrived.map(s => s.id)}`, 'transit', {selector: '.shipment-card[data-id]', destOf: shipDest});

  return (
    <div className="align-list" ref={pageRef}>
      <PageHead title="海外在途" label="IN TRANSIT"/>
      <div className="summary">
        <span><strong>{shs.length}</strong> 个在途包裹</span>
        <span><strong>{albumCount}</strong> 张专辑</span>
        <span>运费合计 <strong>{yuan(sum(shs, 'cost'))}</strong></span>
      </div>
      {(shs.length || arrived.length) ? (
        <>
          {shs.map(s => <ShipmentCard key={s.id} s={s} arrived={false} onArtist={name => openArtistDrawer(app, name)}/>)}
          <div className="section-sub">最近签收 · 可回滚</div>
          {arrived.length
            ? arrived.map(s => <ShipmentCard key={s.id} s={s} arrived onArtist={name => openArtistDrawer(app, name)}/>)
            : <p className="small-note">暂无已签收包裹。</p>}
        </>
      ) : (
        <div className="empty">
          <div className="empty-symbol">✈</div>
          <h3>没有在途包裹</h3>
          <p>在海外库存勾选多张专辑，打包为一趟运输。</p>
          <a className="link-button" href="#overseas">去海外库存</a>
        </div>
      )}
    </div>
  );
}
