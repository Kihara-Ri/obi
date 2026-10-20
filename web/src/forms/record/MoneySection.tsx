// 购买信息的金额行（与「记录售出」同一套 .row-group 行式布局）：买入金额（币种分段在右）、买入日期、
// 额外费用（运单分摊注明）、折合成本。只返回行片段，外层 .row-group 由 RecordForm 提供，
// 购买渠道 / 入库位置作为同组的后续行。
import {Seg} from '../../components/ui/Seg';
import {fmtJPY, yuan} from '../../core/format';
import type {Currency, ShipmentItem} from '../../types';
import {AmountInput} from '../fields';
import type {FormCtx} from './context';

export function MoneySection({ctx, preview, shipItem}: {
  ctx: FormCtx; preview: {hidden: boolean; text: string}; shipItem?: ShipmentItem;
}) {
  const {v, set, dirty} = ctx;
  return <>
    <div className="row amount-row">
      <label htmlFor="f-price">买入金额</label>
      <div className="row-value amount">
        {/* 日元不设步进限制：step 会把 1145 円这类非整十金额判为无效，编辑历史数据时保存被静默拦截 */}
        <input id="f-price" name="price" type="number" min="0"
               step={v.currency === 'JPY' ? 'any' : '0.01'}
               inputMode={v.currency === 'JPY' ? 'numeric' : 'decimal'}
               placeholder="选填" value={v.price}
               onChange={e => {
                 set({price: v.currency === 'JPY' ? e.target.value.replace(/[^\d]/g, '') : e.target.value});
                 dirty();
               }}/>
        <Seg className="seg-cur" ariaLabel="币种"
             options={[{value: 'JPY', label: '円'}, {value: 'CNY', label: '元'}]}
             value={v.currency}
             onValue={c => set({
               currency: c as Currency,
               price: c === 'JPY' && v.price !== '' ? String(Math.round(Number(v.price))) : v.price,
             })}/>
      </div>
    </div>
    <div className="row">
      <label htmlFor="f-date">买入日期</label>
      <div className="row-value">
        <input id="f-date" name="date" type="date" value={v.date}
               onChange={e => { set({date: e.target.value}); dirty(); }}/>
      </div>
    </div>
    <div className="row">
      <label htmlFor="f-fees">额外费用</label>
      <div className="row-value">
        <AmountInput id="f-fees" name="fees" min="0" step="0.01" inputMode="decimal"
                     value={v.fees} onValue={x => {set({fees: x}); dirty();}}/>
        <span className="unit">元</span>
      </div>
    </div>
    {shipItem?.feeOriginal
      ? <p className="row-note">含国际运费 {fmtJPY(shipItem.feeOriginal)} 円 ≈ {yuan(shipItem.fee)}</p> : null}
    {!preview.hidden ? <p className="row-note">{preview.text}</p> : null}
  </>;
}
