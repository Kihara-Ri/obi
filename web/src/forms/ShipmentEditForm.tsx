// 编辑在途包裹：改运输方式 / 运费 / 日期 / 备注，并可移出或添加专辑（总运费不变、按新张数重新平摊）。
import {useEffect, useRef, useState} from 'react';
import {api} from '../core/api';
import {yuan} from '../core/format';
import {useApp} from '../state/AppContext';
import type {AppCtx} from '../state/AppContext';
import type {Currency} from '../types';
import {Field, MoneyField, TextareaField} from './fields';
import {Dropdown} from '../components/ui/Dropdown';
import {AlbumLine} from '../components/AlbumLine';
import {useFormSubmit, useRate} from './shared';
import {methodOptions, costLineText} from './shipShared';

export function openShipmentEdit(app: AppCtx, id: string) {
  app.openDrawer({title: '编辑包裹', asForm: true, content: <ShipmentEditForm id={id}/>});
}

function ShipmentEditForm({id}: {id: string}) {
  const app = useApp();
  const s = app.state.shipments.find(x => x.id === id);
  const {error, saving, run} = useFormSubmit();
  const [v, setV] = useState(() => s ? {
      method: s.method, date: s.date,
      currency: (s.currency || 'CNY') as Currency,
      cost: s.currency === 'JPY' && s.costOriginal ? String(Math.round(Number(s.costOriginal))) : s.cost,
      note: s.note,
    }
    : {method: '', date: '', currency: 'CNY' as Currency, cost: '', note: ''});
  // 增减专辑：移出的包内专辑 id、新加入的海外库存 id；总运费不变，按新张数重新平摊
  const [removed, setRemoved] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const set = (patch: Partial<typeof v>) => { setV(prev => ({...prev, ...patch})); app.setDrawerDirty(true); };
  const toggle = (list: string[], setList: (l: string[]) => void, rid: string) =>
    setList(list.includes(rid) ? list.filter(x => x !== rid) : [...list, rid]);
  // 与打开时快照比对：没改动或改回原值时按钮置灰
  const pristine = useRef(JSON.stringify(v));
  const itemsEdited = removed.length > 0 || added.length > 0;
  const edited = JSON.stringify(v) !== pristine.current || itemsEdited;
  useEffect(() => { app.setDrawerDirty(edited); }, [edited]);
  const o0 = JSON.parse(pristine.current) as typeof v;
  const repricing = v.cost !== o0.cost || v.currency !== o0.currency || v.currency === 'JPY' && v.date !== o0.date;
  const rateInfo = useRate(v.date, v.currency === 'JPY' && repricing && Number(v.cost) !== 0);
  const basis = repricing ? rateInfo.quote : s?.rateQuote;
  const rate = basis?.rate == null ? null : Number(basis.rate);
  const cny = v.cost === '' ? null : Number(v.cost) === 0 ? 0 : v.currency === 'CNY' ? Number(v.cost)
    : rate === null ? null : Number(v.cost) * rate / 100;
  if (!s) return null;

  const transit = s.status === 'transit';
  const inPack = s.items.map(i => app.rec(i.recordId)).filter((r): r is NonNullable<typeof r> => !!r);
  const candidates = app.state.records.filter(r => r.status === 'overseas');
  const count = s.items.length - removed.length + added.length;
  const total = repricing ? cny : Number(s.cost);
  const before = Number(s.cost) / s.items.length;
  const after = total === null || count === 0 ? null : total / count;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const o = JSON.parse(pristine.current) as typeof v;
    // 只带改过的运费字段：仅增减专辑时沿用原总运费，不按当日汇率重算
    const money = v.cost !== o.cost || v.currency !== o.currency ? {cost: v.cost, currency: v.currency} : {};
    run(app, () => api('shipment-update', {id, method: v.method, date: v.date, note: v.note, ...money,
      ...(removed.length ? {remove: removed} : {}), ...(added.length ? {add: added} : {})}));
  };

  return (
    <form id="ship-edit-form" onSubmit={submit}>
      <div className="drawer-body">
        <div className="error" role="alert">{error}</div>
        <div className="field">
          <span className="field-label"><label>运输方式</label></span>
          <Dropdown id="edit-method" label="运输方式" value={v.method}
                    options={methodOptions(v.method)} onPick={m => set({method: m})}/>
        </div>
        <section className="money-block form-section">
          <div className="money-row">
            <MoneyField label="运费" name="edit-cost" currency={v.currency} value={v.cost}
                        onCurrency={(c, val) => set({currency: c, cost: val})}
                        onChange={val => set({cost: val})}/>
            <Field label="发货日期" name="edit-date" type="date" required value={v.date}
                   onChange={e => set({date: e.target.value})}/>
          </div>
          {v.currency === 'JPY' && <div className="cost-line">{!repricing && !basis ? `已记录折合成本 ${yuan(s.cost)}` : costLineText(v.currency, v.cost, rate, cny, basis)}</div>}
        </section>
        <TextareaField label="备注" name="edit-note" value={v.note} onChange={val => set({note: val})}/>
        <section className="form-section ship-items">
          <div className="field-label"><label>包内专辑 · {count} 张</label></div>
          {inPack.map(r => (
            <div key={r.id} className={'ship-item' + (removed.includes(r.id) ? ' removed' : '')}>
              <AlbumLine r={r} showCost={false}/>
              {transit && <button type="button" className="ghost" aria-label={removed.includes(r.id) ? `保留 ${r.title}` : `移出 ${r.title}`}
                                  onClick={() => toggle(removed, setRemoved, r.id)}>{removed.includes(r.id) ? '保留' : '移出'}</button>}
            </div>
          ))}
          {added.map(rid => app.rec(rid)).filter((r): r is NonNullable<typeof r> => !!r).map(r => (
            <div key={r.id} className="ship-item added">
              <AlbumLine r={r} showCost={false}/>
              <button type="button" className="ghost" aria-label={`取消添加 ${r.title}`}
                      onClick={() => toggle(added, setAdded, r.id)}>取消</button>
            </div>
          ))}
          {transit && <button type="button" className="ghost ship-add" aria-expanded={picking}
                              onClick={() => setPicking(p => !p)}>{picking ? '收起' : '＋ 添加专辑'}</button>}
          {transit && picking && (candidates.length === 0 ? <p className="small-note">海外库存里没有可加入的专辑。</p>
            : candidates.map(r => (
              <label key={r.id} className="ship-item pick">
                <input type="checkbox" checked={added.includes(r.id)} onChange={() => toggle(added, setAdded, r.id)}/>
                <AlbumLine r={r} showCost={false}/>
              </label>
            )))}
          {!transit && <p className="small-note">已签收的包裹不能增减专辑；需要时先回滚签收。</p>}
        </section>
        <p className="small-note">
          {itemsEdited && after !== null
            ? `${repricing ? '重算运费后' : '总运费不变，重新平摊'}：每张 ${yuan(Number(before.toFixed(2)))} → ${yuan(Number(after.toFixed(2)))}，保存后各张成本随之调整。`
            : `修改运费或日元发货日期会重算成本分摊（当前每张 ${yuan(Number(before.toFixed(2)))}）。`}
        </p>
      </div>
      <div className="drawer-footer">
        <button type="button" onClick={() => app.backDrawer()}>取消</button>
        <button type="submit" className="primary" aria-busy={saving} disabled={saving || !edited || count === 0}>保存修改</button>
      </div>
    </form>
  );
}
