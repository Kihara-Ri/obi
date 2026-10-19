// 各连接独立保留：仅显式分析才调用；目录和强度以服务商返回能力为准（D-013）。
import {useEffect, useRef, useState} from 'react';
import {api} from '../../core/api';
import type {ListingProvider, ListingProviderId} from '../../core/listing';
import {Dropdown} from '../ui/Dropdown';
import './ListingSettings.css';

const names = {openai: 'OpenAI · ChatGPT OAuth', deepseek: 'DeepSeek · API Key',
  anthropic: 'Anthropic · Claude OAuth', api: 'OpenAI 兼容 API · 独立计费'};
const efforts: Record<string, string> = {none: '关闭思考', minimal: '最低', low: '低', medium: '中',
  high: '高', xhigh: '更高', max: '最高', ultra: '超高'};

export function ListingSettings() {
  const [provider, setProvider] = useState<ListingProvider>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');
  const [code, setCode] = useState('');
  const sequence = useRef(0);
  const popup = useRef<Window | null>(null);
  const refresh = async () => {
    const request = ++sequence.current;
    const value = await api<ListingProvider>('listing/status');
    if (request === sequence.current) setProvider(value);
  };
  useEffect(() => {
    void refresh().catch(e => setError(e.message));
    return () => {sequence.current++;};
  }, []);
  useEffect(() => {
    if (!provider?.loginPending) return;
    const timer = window.setInterval(() => {void refresh().catch(e => setError(e.message));}, 2000);
    return () => window.clearInterval(timer);
  }, [provider?.loginPending]);
  useEffect(() => {
    if (provider?.loginUrl && popup.current && !popup.current.closed) {
      popup.current.location.href = provider.loginUrl;
      popup.current = null;
    }
  }, [provider?.loginUrl]);
  const run = async (work: () => Promise<unknown>) => {
    ++sequence.current; setBusy(true); setError('');
    try {await work(); await refresh();} catch (e) {setError(e instanceof Error ? e.message : '操作失败');}
    finally {setBusy(false);}
  };
  const configure = (patch: object) => run(() => api('listing/provider', {provider: provider?.provider, ...patch}));
  const login = (account = '') => {
    const windowRef = window.open('about:blank', '_blank');
    if (windowRef) windowRef.opener = null;
    popup.current = windowRef;
    void run(async () => {
      try {
        if (!windowRef) throw new Error('请允许弹出窗口后重试');
        const {url} = await api<{url: string}>('listing/login', {provider: provider?.provider, account});
        if (url) {windowRef.location.href = url; popup.current = null;}
      } catch (e) {windowRef?.close(); popup.current = null; throw e;}
    });
  };
  const selected = provider?.models.find(row => row.value === provider.model);
  return <section className="settings-section listing-settings" aria-label="售卖照片识别设置">
    <h3>售卖照片识别</h3>
    <p className="small-note">可同时保留各服务商连接，切换后恢复各自选择。分析仅发送本副本照片、专辑名与艺人。</p>
    <p role="alert" className="error">{error || provider?.loginError}</p>
    {provider ? <>
      <Dropdown label="识别通道" disabled={busy} value={provider.provider}
        options={(Object.keys(names) as ListingProviderId[]).map(value => ({value, label: names[value]}))}
        onPick={value => {setKey(''); setCode(''); void configure({provider: value});}}/>
      <p className="small-note">已连接：{provider.providers.filter(row => row.connected).map(row => names[row.id]).join('、') || '暂无'}</p>
      <p role="status">{provider.connected ? '当前服务商已连接' : provider.loginPending ? '等待完成授权…' : '当前服务商尚未连接'}</p>
      {provider.provider === 'openai' ? <>
        {provider.accounts.length ? <Dropdown label="ChatGPT 账号" disabled={busy} value={provider.active}
          options={provider.accounts.map(account => ({value: account.id, label: account.label}))}
          onPick={active => {void configure({active});}}/> : null}
        {provider.localLoginAvailable ? <div className="photo-actions">
          <button type="button" disabled={busy || provider.loginPending} onClick={() => login()}>Continue with ChatGPT</button>
          {provider.active ? <button type="button" disabled={busy || provider.loginPending} onClick={() => login(provider.active)}>重新授权当前账号</button> : null}
        </div> : <p className="small-note">服务器实例请在电脑本机授权后安全导入，见部署说明。</p>}
        <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noopener noreferrer">ChatGPT 用量与授权 ↗</a>
      </> : null}
      {provider.provider === 'deepseek' ? <div className="listing-credentials">
        <label>DeepSeek API Key<input type="password" autoComplete="new-password" value={key}
          onChange={e => setKey(e.target.value)} maxLength={2000}/></label>
        <button type="button" disabled={busy || !key.trim()} onClick={() => {void run(async () => {
          await api('listing/connection', {provider: 'deepseek', apiKey: key.trim()}); setKey('');
        });}}>保存 DeepSeek 连接</button>
      </div> : null}
      {provider.provider === 'anthropic' ? <>
        {provider.claudeInstalled ? <>
          <button type="button" disabled={busy || provider.loginPending} onClick={() => login()}>使用 Claude 登录</button>
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
      </> : null}
      {provider.provider === 'api' ? <p role="status">{provider.apiConfigured ? `已配置模型：${provider.apiModel}`
        : '请在服务端设置 LISTING_API_BASE、LISTING_API_MODEL 与 LISTING_API_KEY 后重启。'}</p> : null}
      {provider.connected ? <>
        <button type="button" disabled={busy} onClick={() => {void run(() => api(`listing/models?provider=${provider.provider}`));}}>读取可用模型</button>
        {provider.models.length ? <Dropdown label="照片分析模型" disabled={busy} value={provider.model}
          options={[{value: '', label: '请选择模型'}, ...provider.models.map(row => ({value: row.value,
            label: row.label + (row.vision === false ? ' · 仅文字' : ''), disabled: row.vision === false}))]}
          onPick={model => {void configure({model});}}/> : <p className="small-note">当前模型：{provider.model || '尚未选择'}</p>}
        {selected ? <Dropdown label="思考强度" disabled={busy} value={provider.effort}
          options={[{value: '', label: '模型默认'}, ...(selected?.efforts || []).map(value => ({value, label: efforts[value] || value}))]}
          onPick={effort => {void configure({model: provider.model, effort});}}/> : null}
        {selected?.vision === null ? <p className="small-note">目录未声明图片能力，实际可用性以服务商响应为准。</p> : null}
        {provider.provider !== 'api' ? <button type="button" disabled={busy} onClick={() => {void run(async () => {
          const result = await api<{revoked: boolean}>('listing/disconnect', {provider: provider.provider});
          if (!result.revoked) throw new Error('本机授权已清除；远端撤销未确认，请在服务商设置中断开碟渡');
        });}}>断开当前连接</button> : null}
      </> : null}
    </> : <p role="status">正在读取识别配置…</p>}
  </section>;
}
