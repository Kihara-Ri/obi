// 编辑买入信息（管理页的二级表单）：买入金额 / 币种 / 日期 / 额外费用 / 购买渠道。
// 分工：「管理」只管钱，「编辑专辑」只管元数据——买入金额从编辑表单搬到这里。
// 只提交这五个字段；其余资料以服务端当前记录为准（revision 乐观锁），照片等不受影响。
import {useEffect, useRef, useState} from 'react';
import {api} from '../core/api';
import {prefs} from '../core/prefs';
import {useApp} from '../state/AppContext';
import type {AlbumRecord} from '../types';
import type {AppCtx} from '../state/AppContext';
import {ShopField} from '../components/ShopField';
import {useFormSubmit} from './shared';
import {initialValues, type FormCtx, type RecordValues} from './record/context';
import {MoneySection} from './record/MoneySection';
import {useCostPreview} from './record/useCostPreview';

export function openPurchaseForm(app: AppCtx, id: string) {
  app.openDrawer({title: '编辑买入信息', asForm: true, content: <PurchaseForm id={id}/>,
    back: {label: '返回管理', run: () => { app.backDrawer(); }}});
}

export function PurchaseForm({id}: {id: string}) {
  const app = useApp();
  const r = app.rec(id);
  const {error, saving, run, setError} = useFormSubmit();
  const base = useRef<Partial<AlbumRecord>>(r ?? {});
  const [v, setV] = useState<RecordValues>(() => initialValues(base.current, null));
  const live = useRef(v); live.current = v;
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = () => app.setDrawerDirty(true);
  const ctx: FormCtx = {v, setV, live, base, dirty, formRef, set: patch => setV(prev => ({...prev, ...patch}))};
  const preview = useCostPreview(v, true);
  const shipItem = (() => {
    const s = r?.shipmentId ? app.state.shipments.find(x => x.id === r.shipmentId) : undefined;
    return s && s.currency === 'JPY' ? s.items.find(i => i.recordId === id) : undefined;
  })();

  const sign = () => JSON.stringify([v.price, v.currency, v.date, v.fees, v.location]);
  const pristine = useRef(sign());
  const edited = sign() !== pristine.current;
  useEffect(() => { app.setDrawerDirty(edited); }, [edited]);
  if (!r) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const o = base.current;
    const openedPrice = o.currency === 'JPY' && o.price !== '' ? String(Math.round(Number(o.price))) : (o.price || '');
    const payload: Record<string, unknown> = {
      id, revision: r.revision, price: v.price, currency: v.currency, date: v.date, fees: v.fees, location: v.location,
    };
    // 金额 / 币种 / 日期变了，原先登记的实际人民币支出就不再对应，清空后按当日汇率重算
    if (v.price !== openedPrice || v.currency !== o.currency || v.date !== o.date) payload.actual = '';
    run(app, async () => {
      await api('records', payload);
      prefs.set('location', v.location);
      prefs.set('currency', v.currency);
    }, '买入信息已保存', {backOnSave: true});
  };

  return (
    <form id="purchase-form" ref={formRef} onSubmit={submit} noValidate>
      <div className="drawer-body">
        <div className="error" role="alert">{error}</div>
        <h3 className="section-title form-group-title">{r.title}</h3>
        <div className="row-group">
          <MoneySection ctx={ctx} preview={preview} shipItem={shipItem}/>
          <ShopField value={v.location} records={app.state.records} defaultShop={prefs.get('location', '')}
                     onChange={val => { ctx.set({location: val}); dirty(); }}/>
        </div>
      </div>
      <div className="drawer-footer">
        <button type="button" onClick={() => { setError(''); app.backDrawer(); }}>取消</button>
        <button type="submit" className="primary" aria-busy={saving} disabled={saving || !edited}>保存</button>
      </div>
    </form>
  );
}
