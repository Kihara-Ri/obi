// 表单字段构造：受控 input / 自动长高 textarea / 币种金额组（买入金额同款）/
// 日期快捷行（今天 / 昨天 / 选日期，记录售出与确认表单共用）。
import type {InputHTMLAttributes, MouseEvent} from 'react';
import {AutoTextarea} from '../components/ui/AutoTextarea';
import {Seg} from '../components/ui/Seg';
import {today, yesterday} from '../core/format';
import type {Currency} from '../types';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {label: string; name: string};

export function Field({label, name, ...rest}: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={`f-${name}`}>{label}</label>
      <input id={`f-${name}`} name={name} {...rest}/>
    </div>
  );
}

// 币种分段 + 金额输入（与专辑「买入金额」同一组件）：切到日元时金额取整。
export function MoneyField({label, name, currency, value, onCurrency, onChange}: {
  label: string; name: string; currency: Currency; value: string;
  onCurrency: (c: Currency, value: string) => void; onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={`f-${name}`}>{label}</label>
      <div className="amount-group">
        <Seg className="seg-cur" ariaLabel="币种"
             options={[{value: 'JPY', label: '日元'}, {value: 'CNY', label: '人民币'}]}
             value={currency}
             onValue={c => onCurrency(c as Currency,
               c === 'JPY' && value !== '' ? String(Math.round(Number(value))) : value)}/>
        {/* 日元不设步进限制：step=10 会把 1145 円这类非整十金额判为无效，表单提交被浏览器静默拦截；
           整数口径由输入过滤保证（numeric 键盘无小数点，硬件键入也滤掉 .） */}
        <input id={`f-${name}`} name={name} type="number" required min="0"
               step={currency === 'JPY' ? 'any' : '0.01'}
               inputMode={currency === 'JPY' ? 'numeric' : 'decimal'}
               placeholder="按币种填写" value={value}
               onChange={e => onChange(currency === 'JPY' ? e.target.value.replace(/[^\d]/g, '') : e.target.value)}/>
      </div>
    </div>
  );
}

export function TextareaField({label, name, value, onChange, className = ''}: {
  label: string; name: string; value: string;
  onChange: (v: string) => void; className?: string;
}) {
  return (
    <div className={`field full ${className}`.trim()}>
      <label htmlFor={`f-${name}`}>{label}</label>
      <AutoTextarea id={`f-${name}`} name={name} value={value}
                    onChange={e => onChange(e.target.value)}/>
    </div>
  );
}

// 日期快捷行（row-group 行形态）：今天 / 昨天 / 选日期，点按即弹系统选择器。
// 隐形日期输入铺满「选日期」块，iOS/桌面一致；自定义日期显示为「N月N日」。
export function DateChipsRow({label, value, onChange}: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const dToday = today();
  const dYesterday = yesterday();
  const preset = value === dToday ? 'today' : value === dYesterday ? 'yesterday' : 'custom';
  const pickDate = (e: MouseEvent<HTMLLabelElement>) => {
    const inp = e.currentTarget.querySelector<HTMLInputElement>('input[type=date]');
    if (!inp) return;
    try { inp.showPicker(); } catch { /* 旧浏览器退回 label 激活 */ }
  };
  return (
    <div className="row">
      <label>{label}</label>
      <div className="row-value chips" role="group" aria-label={label}>
        <button type="button" className={`chip${preset === 'today' ? ' on' : ''}`}
                onClick={() => onChange(dToday)}>今天</button>
        <button type="button" className={`chip${preset === 'yesterday' ? ' on' : ''}`}
                onClick={() => onChange(dYesterday)}>昨天</button>
        <label className={`chip${preset === 'custom' ? ' on' : ''}`} onClick={pickDate}>
          {preset === 'custom' ? `${Number(value.slice(5, 7))}月${Number(value.slice(8, 10))}日` : '选日期'}
          <input className="vh-date" type="date" value={value}
                 onChange={e => e.target.value && onChange(e.target.value)}/>
        </label>
      </div>
    </div>
  );
}
