// 设置 · 高级 · MCP 服务（D-052）：连接地址、调用方列表、签发 / 轮换 / 撤销令牌。
// 与命令行 server.client_admin 管同一份调用方清单。本机模式（浏览器本机站点、安卓本机引擎）没有 MCP，不显示。
// 令牌只在签发和轮换后显示一次；撤销要点两下确认。
import {useEffect, useState} from 'react';
import {api} from '../../core/api';
import {isLocalSite} from '../../core/backend';
import {useApp} from '../../state/AppContext';
import {CopyButton} from '../CopyButton';
import {Disclosure} from '../ui/Disclosure';
import {McpIssueForm} from './McpIssueForm';
import {McpTokenReveal} from './McpTokenReveal';
import {type Issued, type McpState, scopeText} from './scopes';
import './McpSettings.css';

const GUIDE = 'https://github.com/Kihara-Ri/obi/blob/main/docs/MCP%E6%8E%A5%E5%85%A5.md';

export function McpSettings() {
  const app = useApp();
  const [state, setState] = useState<McpState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [issued, setIssued] = useState<{name: string; token: string} | null>(null);
  const [revoking, setRevoking] = useState('');
  const local = isLocalSite();

  useEffect(() => {
    if (local) return;
    api<McpState>('clients').then(setState, e => setError(e instanceof Error ? e.message : '读取失败'));
  }, [local]);
  if (local) return null;

  const run = async (path: string, body: object, done?: string) => {
    setBusy(true); setError('');
    try {
      const next = await api<McpState | Issued>('clients/' + path, body);
      setState(next);
      if ('token' in next) { setIssued({name: next.name, token: next.token}); setAdding(false); }
      if (done) app.toast(done);
    } catch (e) { setError(e instanceof Error ? e.message : '操作失败，请重试'); }
    finally { setBusy(false); setRevoking(''); }
  };

  const url = state?.available ? window.location.origin + state.path : '';
  const clients = state?.available ? state.clients : [];
  const status = !state ? (error ? '' : '正在读取…') : !state.available ? state.reason
    : clients.length ? `已启用 · ${clients.length} 个调用方` : '未启用 · 新增调用方后启用';

  return <section className="settings-section" aria-label="MCP 服务">
    <h3>MCP 服务 · 让 Agent 调用</h3>
    {status ? <p role="status">{status}{state?.available && state.legacy.length ? ' · 另有旧令牌文件' : ''}</p> : null}
    {error ? <p className="error" role="alert">{error}</p> : null}
    {state?.available ? <>
      <div className="mcp-code mcp-url"><code>{url}</code><CopyButton text={url} label="复制 MCP 地址"/></div>
      {issued ? <McpTokenReveal name={issued.name} token={issued.token} url={url} onDone={() => setIssued(null)}/> : null}
      {clients.length ? <ul className="mcp-clients">
        {clients.map(c => <li key={c.name}>
          <div className="mcp-client-text"><strong>{c.name}</strong><small>{scopeText(c.scopes)}</small>
            {c.createdAt ? <small>签发于 {c.createdAt.slice(0, 10)}</small> : null}</div>
          <div className="mcp-client-actions">
            <button type="button" className="quiet" disabled={busy}
              onClick={() => void run('rotate', {name: c.name}, `已为「${c.name}」换新令牌，旧令牌立即失效`)}>换令牌</button>
            <button type="button" className={revoking === c.name ? 'danger' : 'quiet'} disabled={busy}
              onClick={() => revoking === c.name ? void run('revoke', {name: c.name}, `已撤销「${c.name}」`) : setRevoking(c.name)}>
              {revoking === c.name ? '确认撤销' : '撤销'}</button>
          </div>
        </li>)}
      </ul> : null}
      {adding ? <McpIssueForm busy={busy} onCancel={() => setAdding(false)}
        onIssue={(name, scopes) => void run('issue', {name, scopes}, `已签发「${name}」`)}/>
        : <div className="inline-actions">
          <button type="button" className={clients.length ? '' : 'primary'} disabled={busy || !!issued}
            onClick={() => { setAdding(true); setRevoking(''); }}>新增调用方</button>
        </div>}
      <Disclosure>
        <p>Claude Code、Cursor、Claude Desktop 等支持 MCP 的 Agent 填上地址和令牌，就能查已购、评估采购候选、取上架资料并登记交易。每个调用方一枚令牌，只能用开了的权限。</p>
        <p>令牌只在签发和换令牌后显示一次，服务器只存摘要；撤销或换令牌立即生效。连接方法见 <a href={GUIDE} target="_blank" rel="noopener noreferrer">MCP 接入说明 ↗</a>。</p>
      </Disclosure>
    </> : null}
  </section>;
}
