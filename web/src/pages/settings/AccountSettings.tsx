// 设置 · 账户：登录与安全（登录密码默认收起、退出登录）、已连接服务（视觉模型，仅二手交易）、安装到主屏幕的提示（未安装时）。
import {useState} from 'react';
import {api} from '../../core/api';
import {clearCoverCache} from '../../core/cover-cache';
import {useApp} from '../../state/AppContext';
import {Collapse} from '../../components/ui/Collapse';
import {PasswordChange} from './PasswordChange';
import {ListingSettings} from '../../components/ListingSettings';
import './AccountSettings.css';

// 已从主屏幕启动（PWA）或本身就是安卓应用时不再提示安装
const installed = () => 'ObiAndroid' in window || window.matchMedia('(display-mode: standalone)').matches
  || (navigator as Navigator & {standalone?: boolean}).standalone === true;

export function AccountSettings() {
  const app = useApp();
  const loginOn = !!app.state.service?.login;
  const [open, setOpen] = useState(false);

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
            <button type="button" className="account-row" aria-expanded={open} aria-controls="pw-panel" onClick={() => setOpen(!open)}>
              <span className="account-row-main"><strong>登录密码</strong><small>更改后其他设备会退出登录</small></span>
              <span className="account-row-action">{open ? '收起' : '修改'}</span>
            </button>
            <Collapse open={open} id="pw-panel"><PasswordChange onDone={() => setOpen(false)}/></Collapse>
            <button type="button" className="account-row is-danger" onClick={logout}>
              <span className="account-row-main"><strong>退出登录</strong><small>同时清除本机缓存的封面</small></span>
            </button>
          </>
        ) : <p className="small-note">当前为本机模式，未启用登录。</p>}
      </section>

      {/* 视觉模型只服务售卖照片识别；未开二手交易时只留一行指引，不再整块消失（安卓上曾被误以为没装上） */}
      {app.modules.trading ? <ListingSettings/> : <section className="settings-section account-section">
        <h3>已连接服务</h3>
        <p className="small-note">售卖照片识别用的视觉模型（OpenCode / DeepSeek 等）在「功能」里开启「二手交易」后出现在这里。</p>
      </section>}

      {installed() ? null : (
        <section className="settings-section account-section">
          <h3>安装到主屏幕</h3>
          <p className="small-note">在手机浏览器的分享或菜单里选择「添加到主屏幕」，之后像普通应用一样打开。</p>
        </section>
      )}
    </>
  );
}
