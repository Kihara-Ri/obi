// 表单字段构造：受控 input / 自动长高 textarea / 币种金额组（买入金额同款）/
// 日期快捷行（今天 / 昨天 / 选日期，记录售出与确认表单共用）。
import {useEffect, useState} from 'react';
import type {ChangeEvent, FocusEvent, InputHTMLAttributes, MouseEvent} from 'react';
import {AutoTextarea} from '../components/ui/AutoTextarea';
import {FocusInput} from '../components/ui/FocusInput/FocusInput';
import {Seg} from '../components/ui/Seg';
import {today, yesterday} from '../core/format';
import type {Currency} from '../types';

// 金额输入：清空后回到 0（费用类金额 0 是合法值），0 在聚焦时整体选中，直接输入即覆盖而不是接在 0 后面。
// 成本/买入价「未知 = null」的字段传 zeroOnEmpty={false}，保持可留空。
export function AmountInput({value, onValue, integer = false, zeroOnEmpty = true, ...rest}:
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> &
  {value: string; onValue: (v: string) => void; integer?: boolean; zeroOnEmpty?: boolean}) {
  const sheet = useSheet();
  const [open, setOpen] = useState(false);
  const selectZero = (el: HTMLInputElement) => {
    if (el.value !== '' && Number(el.value) === 0) requestAnimationFrame(() => el.select());
  };
  const change = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    let raw = integer ? el.value.split('.')[0].replace(/[^\d]/g, '') : el.value;
    // 输入到一半（如「1.」「-」）时 value 为空但并非用户清空，不能当成清空重置
    if (raw === '' && el.validity.badInput) return;
    if (raw === '' && zeroOnEmpty) raw = '0';
    else raw = raw.replace(/^0+(?=\d)/, '');
    onValue(raw);
    if (raw === '0') requestAnimationFrame(() => el.select());
  };
  if (!sheet) {
    return <input {...rest} type="number" value={value} onChange={change}
                  onFocus={(e: FocusEvent<HTMLInputElement>) => { selectZero(e.currentTarget); rest.onFocus?.(e); }}/>;
  }
  // 手机：输入框只读（不拉键盘、不触发抽屉的键盘避让），点一下升起悬浮输入层，页面全程不动
  const draft = (v: string) => {
    let raw = v.replace(integer ? /[^\d]/g : /[^\d.]/g, '');
    if (!integer) { const i = raw.indexOf('.'); if (i >= 0) raw = raw.slice(0, i + 1) + raw.slice(i + 1).replace(/\./g, ''); }
    if (raw === '' && zeroOnEmpty) raw = '0';
    else raw = raw.replace(/^0+(?=\d)/, '');
    onValue(raw);
  };
  const title = (rest.id && document.querySelector(`label[for="${rest.id}"]`)?.textContent) || '输入金额';
  return <>
    <input {...rest} type="number" readOnly inputMode="none" value={value} onChange={() => {}}
           onClick={() => setOpen(true)}/>
    <FocusInput open={open} title={title} value={value} placeholder={rest.placeholder}
                inputMode={integer ? 'numeric' : 'decimal'} submitLabel="完成" enterKeyHint="done"
                onChange={draft} onSubmit={() => setOpen(false)} onClose={() => setOpen(false)}/>
  </>;
}

export function useSheet() {
  const q = '(max-width:840px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return m;
}

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
           整数口径由输入过滤保证（numeric 键盘无小数点；粘贴 1234.5 取整数部分 1234，不会把小数点吞掉变成 12345） */}
        <AmountInput id={`f-${name}`} name={name} required min="0"
               step={currency === 'JPY' ? 'any' : '0.01'}
               inputMode={currency === 'JPY' ? 'numeric' : 'decimal'}
               placeholder="按币种填写" value={value} integer={currency === 'JPY'} zeroOnEmpty={false}
               onValue={onChange}/>
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
