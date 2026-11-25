// 设置 · 账户：登录与安全、退出登录与安装提示。
import {api} from '../../core/api';
import {clearCoverCache} from '../../core/cover-cache';
import {useApp} from '../../state/AppContext';
import './AccountSettings.css';

// 已从主屏幕启动（PWA）或本身就是安卓应用时不再提示安装
const installed = () => 'ObiAndroid' in window || window.matchMedia('(display-mode: standalone)').matches
  || (navigator as Navigator & {standalone?: boolean}).standalone === true;

export function AccountSettings() {
  const app = useApp();
  const loginOn = !!app.state.service?.login;

  const logout = async () => {
    await api('logout', {});
    await clearCoverCache();
    location.replace('/login');
  };

  return (
    <>
      <section className="settings-section account-section">
        <h3>登录与安全</h3>
        {loginOn ? (
          <>
            <p className="small-note">Google Authenticator 动态码</p>
            <button type="button" className="account-row is-danger" onClick={logout}>
              <span className="account-row-main"><strong>退出登录</strong><small>同时清除本机缓存的封面</small></span>
            </button>
          </>
        ) : <p className="small-note">当前为本机模式，未启用登录。</p>}
      </section>

      {installed() ? null : (
        <section className="settings-section account-section">
          <h3>安装到主屏幕</h3>
          <p className="small-note">在手机浏览器的分享或菜单里选择「添加到主屏幕」，之后像普通应用一样打开。</p>
        </section>
      )}
    </>
  );
}
