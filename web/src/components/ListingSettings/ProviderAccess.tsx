// 密钥 / 授权区：DeepSeek 用密钥（只显示末四位）；OpenAI、Claude 走授权登录；兼容 API 由服务端配置。
import {useState} from 'react';
import {api} from '../../core/api';
import type {ListingProvider} from '../../core/listing';
import {Dropdown} from '../ui/Dropdown';

interface Props {
  provider: ListingProvider; busy: boolean;
  run: (work: () => Promise<unknown>) => Promise<void>;
  configure: (patch: object) => Promise<void>;
  login: (account?: string) => void;
}

export function ProviderAccess({provider, busy, run, configure, login}: Props) {
  const [key, setKey] = useState('');
  const [code, setCode] = useState('');
  const [replacing, setReplacing] = useState(false);
  const id = provider.provider;
  const disconnect = () => {void run(async () => {
    const result = await api<{revoked: boolean}>('listing/disconnect', {provider: id});
    if (!result.revoked) throw new Error('本机授权已清除；远端撤销未确认，请在服务商设置中断开碟渡');
  });};
  if (id === 'deepseek') return <div className="provider-block">
    {provider.keyTail && !replacing ? <div className="provider-keyrow">
      <span className="provider-mask" aria-label="已保存的密钥">sk-••••••••{provider.keyTail}</span>
      <button type="button" disabled={busy} onClick={() => setReplacing(true)}>更换密钥</button>
      {provider.keySource === 'saved' ? <button type="button" className="danger" disabled={busy} onClick={disconnect}>移除密钥</button> : null}
    </div> : <div className="listing-credentials">
      <label>DeepSeek API Key<input type="password" autoComplete="new-password" value={key}
        onChange={e => setKey(e.target.value)} maxLength={2000}/></label>
      <div className="provider-keyrow">
        <button type="button" disabled={busy || !key.trim()} onClick={() => {void run(async () => {
          await api('listing/connection', {provider: 'deepseek', apiKey: key.trim()}); setKey(''); setReplacing(false);
        });}}>保存密钥</button>
        {replacing ? <button type="button" disabled={busy} onClick={() => {setReplacing(false); setKey('');}}>取消</button> : null}
      </div>
    </div>}
    <p className="small-note">密钥只保存在服务器的受限文件中，不会回传到页面，也不进入业务备份。</p>
    <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer">获取密钥 ↗</a>
  </div>;
  if (id === 'openai') return <div className="provider-block">
    <p role="status">{provider.connected ? '已授权 ChatGPT' : provider.loginPending ? '等待完成授权…' : '尚未授权'}</p>
    {provider.accounts.length ? <Dropdown label="ChatGPT 账号" disabled={busy} value={provider.active}
      options={provider.accounts.map(account => ({value: account.id, label: account.label}))}
      onPick={active => {void configure({active});}}/> : null}
    {provider.localLoginAvailable ? <div className="provider-keyrow">
      <button type="button" disabled={busy || provider.loginPending} onClick={() => login()}>Continue with ChatGPT</button>
      {provider.active ? <button type="button" disabled={busy || provider.loginPending} onClick={() => login(provider.active)}>重新授权当前账号</button> : null}
    </div> : <p className="small-note">服务器实例请在电脑本机授权后安全导入，见部署说明。</p>}
    {provider.connected ? <button type="button" className="danger" disabled={busy} onClick={disconnect}>断开连接</button> : null}
    <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noopener noreferrer">ChatGPT 用量与授权 ↗</a>
  </div>;
  if (id === 'anthropic') return <div className="provider-block">
    <p role="status">{provider.connected ? '已授权 Claude' : provider.loginPending ? '等待完成授权…' : '尚未授权'}</p>
    {provider.claudeInstalled ? <>
      <div className="provider-keyrow">
        <button type="button" disabled={busy || provider.loginPending} onClick={() => login()}>使用 Claude 登录</button>
        {provider.connected ? <button type="button" className="danger" disabled={busy} onClick={disconnect}>断开连接</button> : null}
      </div>
      {provider.loginPending ? <div className="listing-credentials">
        {provider.loginUrl ? <a href={provider.loginUrl} target="_blank" rel="noopener noreferrer">打开 Claude 授权页面 ↗</a> : null}
        <label>Claude 返回的授权码（如有）<input type="password" autoComplete="off" value={code}
          onChange={e => setCode(e.target.value)} maxLength={3000}/></label>
        <button type="button" disabled={busy || !code.trim()} onClick={() => {void run(async () => {
          await api('listing/auth-code', {code: code.trim()}); setCode('');
        });}}>提交授权码</button>
      </div> : null}
    </> : <p className="small-note">请在服务端安装官方 Claude Code；Docker 镜像默认不包含，安装方法见部署说明。</p>}
    <p className="small-note">通过官方 Claude Code 使用独立授权，额度与计费由 Claude 账户决定。</p>
  </div>;
  return <p role="status">{provider.apiConfigured ? `已在服务端配置：${provider.apiModel}`
    : '请在服务端设置 LISTING_API_BASE、LISTING_API_MODEL 与 LISTING_API_KEY 后重启。'}</p>;
}
