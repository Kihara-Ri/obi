// 库存多选后「加入已有包裹」：选一个在途包裹，把所选海外库存专辑并入（总运费不变，重新平摊）。
import {useState} from 'react';
import {api} from '../core/api';
import {yuan} from '../core/format';
import {useApp} from '../state/AppContext';
import type {AppCtx} from '../state/AppContext';
import {AlbumLine} from '../components/AlbumLine';
import {useFormSubmit} from './shared';

export function openJoinShipment(app: AppCtx, ids: string[]) {
  app.openDrawer({title: '加入已有包裹', asForm: true, content: <JoinShipmentForm ids={ids}/>});
}

function JoinShipmentForm({ids}: {ids: string[]}) {
  const app = useApp();
  const {error, saving, run} = useFormSubmit();
  const parcels = app.state.shipments.filter(s => s.status === 'transit');
  const [pick, setPick] = useState(parcels.length === 1 ? parcels[0].id : '');
  const rs = ids.map(app.rec).filter((r): r is NonNullable<typeof r> => !!r);
  const chosen = parcels.find(s => s.id === pick);
  const per = (n: number) => yuan(Number((Number(chosen?.cost ?? 0) / n).toFixed(2)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(app, () => api('shipment-update', {id: pick, add: ids}));
  };

  return (
    <form id="ship-join-form" onSubmit={submit}>
      <div className="drawer-body">
        <div className="error" role="alert">{error}</div>
        <p className="help">这 {rs.length} 张专辑并入所选在途包裹，状态变为「海外在途」。</p>
        {rs.map(r => <AlbumLine key={r.id} r={r} showCost={false}/>)}
        <div className="field form-section">
          <span className="field-label"><label>选择包裹</label></span>
          {parcels.length === 0 ? <p className="small-note">当前没有在途包裹。</p> : null}
          {parcels.map(s => (
            <button key={s.id} type="button" className={'join-parcel' + (s.id === pick ? ' active' : '')}
                    aria-pressed={s.id === pick} onClick={() => { setPick(s.id); app.setDrawerDirty(true); }}>
              <strong>{s.method}</strong>
              <span>{s.date} 发货 · {s.items.length} 张 · 运费 {yuan(Number(s.cost))}</span>
            </button>
          ))}
        </div>
        {chosen ? <p className="small-note">
          总运费不变，重新平摊：每张 {per(chosen.items.length)} → {per(chosen.items.length + rs.length)}。
        </p> : null}
      </div>
      <div className="drawer-footer">
        <button type="button" onClick={() => app.backDrawer()}>取消</button>
        <button type="submit" className="primary" aria-busy={saving} disabled={saving || !chosen}>加入包裹</button>
      </div>
    </form>
  );
}
