// 设置 · 账户 · 修改登录密码：三个字段 + 实时规则提示，满足全部规则才可提交。
// 改密后服务端会让其他设备退出登录，当前设备保持登录。
import {useState} from 'react';
import {api} from '../../core/api';
import {useApp} from '../../state/AppContext';
import './PasswordChange.css';

const MIN_LEN = 12;
const EMPTY = {current: '', next: '', confirm: ''};

export function PasswordChange({onDone}: {onDone: () => void}) {
  const app = useApp();
  const [pw, setPw] = useState(EMPTY);
  const [show, setShow] = useState(false);
  const [changing, setChanging] = useState(false);

  const longEnough = pw.next.length >= MIN_LEN;
  const matches = !!pw.confirm && pw.next === pw.confirm;
  const mismatch = !!pw.confirm && pw.next !== pw.confirm;
  const valid = !!pw.current && longEnough && matches;
  const type = show ? 'text' : 'password';
  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setPw({...pw, [key]: e.target.value});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || changing) return;
    setChanging(true);
    try {
      await api('password', {current: pw.current, next: pw.next});
      app.toast('密码已更改，其他设备已退出登录');
      setPw(EMPTY);
      setShow(false);
      onDone();
    } catch (err) {
      app.toast(err instanceof Error ? err.message : String(err), 'err');
    } finally {
      setChanging(false);
    }
  };

  return (
    <form className="pw-form" onSubmit={submit}>
      <label className="pw-field"><span>当前密码</span>
        <input type={type} autoComplete="current-password" maxLength={1024} value={pw.current} onChange={set('current')}/>
      </label>
      <label className="pw-field"><span>新密码</span>
        <input type={type} autoComplete="new-password" maxLength={1024} value={pw.next} onChange={set('next')}/>
        <small className={longEnough ? 'pw-hint is-ok' : 'pw-hint'}>至少 {MIN_LEN} 位{pw.next ? `（已输入 ${pw.next.length} 位）` : ''}</small>
      </label>
      <label className="pw-field"><span>确认新密码</span>
        <input type={type} autoComplete="new-password" maxLength={1024} value={pw.confirm} onChange={set('confirm')}/>
        <small className={matches ? 'pw-hint is-ok' : mismatch ? 'pw-hint is-bad' : 'pw-hint'}>
          {mismatch ? '两次输入不一致' : matches ? '两次输入一致' : '再输入一次新密码'}
        </small>
      </label>
      <div className="pw-actions">
        <button type="button" className="quiet" aria-pressed={show} onClick={() => setShow(!show)}>{show ? '隐藏密码' : '显示密码'}</button>
        <button type="submit" className="primary" disabled={!valid || changing}>{changing ? '更改中…' : '更改密码'}</button>
      </div>
    </form>
  );
}
