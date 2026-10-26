// 文本输入框（手机用聚焦输入层）：手机上输入框只读，点一下在键盘上方升起 FocusInput，背后页面不动、不自动滚动；
// 桌面是普通输入框。与 AmountInput 同一套机制，用于专辑名、艺人这类必须打字的重点字段。
import {useState} from 'react';
import {FocusInput} from '../components/ui/FocusInput/FocusInput';
import {Field, useSheet} from './fields';

export function FocusField({label, name, value, onValue, required, placeholder}: {
  label: string; name: string; value: string; onValue: (v: string) => void; required?: boolean; placeholder?: string;
}) {
  const sheet = useSheet();
  const [open, setOpen] = useState(false);
  if (!sheet) {
    return <Field label={label} name={name} required={required} autoComplete="off" placeholder={placeholder} value={value}
                  onChange={e => onValue(e.target.value)}/>;
  }
  const close = () => setOpen(false);
  return (
    <div className="field">
      <label htmlFor={`f-${name}`}>{label}</label>
      <input id={`f-${name}`} name={name} required={required} placeholder={placeholder} autoComplete="off" readOnly inputMode="none"
             value={value} onChange={() => {}} onClick={() => setOpen(true)}/>
      <FocusInput open={open} title={label} value={value} placeholder={placeholder} submitLabel="完成" enterKeyHint="done"
                  onChange={onValue} onSubmit={close} onClose={close}/>
    </div>
  );
}
