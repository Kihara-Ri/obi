// 打包运输表单（海外库存多选）；编辑包裹见 ShipmentEditForm。
// 运输方式=日本邮政个人国际邮件全方案；运费复用「买入金额」的币种金额组，
// 日元按发货日汇率折算人民币后均摊（服务端折算，见 storage.to_cny）。
import {useState} from 'react';
import {api} from '../core/api';
import {today, yuan} from '../core/format';
import {useApp} from '../state/AppContext';
import type {AppCtx} from '../state/AppContext';
import type {Currency} from '../types';
import {Field, MoneyField, TextareaField} from './fields';
import {Dropdown} from '../components/ui/Dropdown';
import {AlbumLine} from '../components/AlbumLine';
import {useFormSubmit, useRate} from './shared';
import {JP_METHODS, methodOptions, costLineText} from './shipShared';

export function openShipForm(app: AppCtx, ids: string[]) {
  app.openDrawer({title: '打包运输', asForm: true, content: <ShipForm ids={ids}/>});
}

function ShipForm({ids}: {ids: string[]}) {
  const app = useApp();
  const {error, saving, run} = useFormSubmit();
  const [v, setV] = useState({method: JP_METHODS[0].value, date: today(), currency: 'CNY' as Currency, cost: '', note: ''});
  const set = (patch: Partial<typeof v>) => { setV(prev => ({...prev, ...patch})); app.setDrawerDirty(true); };
  const rs = ids.map(app.rec).filter((r): r is NonNullable<typeof r> => !!r);
  const rate = useRate(v.date);
  const cny = v.cost === '' ? null : v.currency === 'CNY' ? Number(v.cost)
    : rate === null ? null : Number(v.cost) * rate / 100;
  const cnyQ = cny === null ? null : Number(cny.toFixed(2));
  const share = cnyQ === null ? null : cnyQ / rs.length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(app, () => api('shipments', {...v, ids}));
  };

  return (
    <form id="ship-form" onSubmit={submit}>
      <div className="drawer-body">
        <div className="error" role="alert">{error}</div>
        <p className="help">这 {rs.length} 张专辑打包为一趟运输，状态变为「海外在途」，约 11 天后签收。</p>
        {rs.map(r => <AlbumLine key={r.id} r={r} showCost={false}/>)}
        <div className="field form-section">
          <span className="field-label"><label>运输方式</label></span>
          <Dropdown id="ship-method" label="运输方式" value={v.method}
                    options={methodOptions(v.method)} onPick={m => set({method: m})}/>
        </div>
        <section className="money-block form-section">
          <div className="money-row">
            <MoneyField label="运费" name="ship-cost" currency={v.currency} value={v.cost}
                        onCurrency={(c, val) => set({currency: c, cost: val})}
                        onChange={val => set({cost: val})}/>
            <Field label="发货日期" name="ship-date" type="date" required value={v.date}
                   onChange={e => set({date: e.target.value})}/>
          </div>
          {v.currency === 'JPY' && <div className="cost-line">{costLineText(v.currency, v.cost, rate, cny)}</div>}
        </section>
        <TextareaField label="备注" name="ship-note" value={v.note} onChange={val => set({note: val})}/>
        <div className="preview">
          <strong>{rs.length} 张 · 运费 {cnyQ === null ? '—' : yuan(cnyQ)}</strong>
          <p>{share === null || share === 0 ? '未填运费则不增加成本。'
            : `运费均摊到每张成本：+${yuan(Number(share.toFixed(2)))}，签收前可撤销或修改。`}</p>
        </div>
      </div>
      <div className="drawer-footer">
        <button type="button" onClick={() => app.backDrawer()}>取消</button>
        <button type="submit" className="primary" aria-busy={saving} disabled={saving}>创建运输</button>
      </div>
    </form>
  );
}
