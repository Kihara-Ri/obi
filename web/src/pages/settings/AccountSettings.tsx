// 设置 · 账户：登录密码（启用登录时）、退出登录、安装到主屏幕的提示。
import {useState} from 'react';
import {api} from '../../core/api';
import {useApp} from '../../state/AppContext';
import {Disclosure} from '../../components/ui/Disclosure';

export function AccountSettings() {
  const app = useApp();
  const {state} = app;
  const [pw, setPw] = useState({current: '', next: '', confirm: ''});
  const [changing, setChanging] = useState(false);

  const logout = async () => {
    await api('logout', {});
    location.replace('/login');
  };

  // 改密：服务端会踢掉其他设备；本机模式（未启用登录）不渲染此节
  const changePassword = async () => {
    if (pw.next.length < 12) { app.toast('新密码至少需要 12 个字符', 'err'); return; }
    if (pw.next !== pw.confirm) { app.toast('两次输入的新密码不一致', 'err'); return; }
    setChanging(true);
    try {
      await api('password', {current: pw.current, next: pw.next});
      app.toast('密码已更改，其他设备已退出登录');
      setPw({current: '', next: '', confirm: ''});
    } catch (err) {
      app.toast(err instanceof Error ? err.message : String(err), 'err');
    } finally {
      setChanging(false);
    }
  };

  return (
    <>
      {state.service?.login ? (
        <section className="settings-section">
          <h3>登录密码</h3>
          <div className="pw-change">
            <input type="password" placeholder="当前密码" autoComplete="current-password" maxLength={1024}
                   aria-label="当前密码" value={pw.current}
                   onChange={e => setPw({...pw, current: e.target.value})}/>
            <input type="password" placeholder="新密码（至少 12 位）" autoComplete="new-password" maxLength={1024}
                   aria-label="新密码" value={pw.next}
                   onChange={e => setPw({...pw, next: e.target.value})}/>
            <input type="password" placeholder="再输入一次新密码" autoComplete="new-password" maxLength={1024}
                   aria-label="确认新密码" value={pw.confirm}
                   onChange={e => setPw({...pw, confirm: e.target.value})}/>
            <button className="primary" disabled={changing || !pw.current || !pw.next || !pw.confirm}
                    onClick={changePassword}>更改密码</button>
          </div>
          <Disclosure>
            <p>更改后其他已登录设备会全部退出，需用新密码重新登录；当前设备保持登录。</p>
          </Disclosure>
        </section>
      ) : null}

      <section className="settings-section">
        <h3>访问</h3>
        {state.service?.login ? <button onClick={logout}>退出登录</button> : <p className="small-note">当前为本机模式，未启用登录。</p>}
        <Disclosure summary="安装到主屏幕">
          <p>手机可通过浏览器菜单「添加到主屏幕」安装。</p>
        </Disclosure>
      </section>
    </>
  );
}
