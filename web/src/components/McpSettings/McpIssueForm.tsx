// MCP 服务 · 新增调用方：名称 + 四项权限开关；至少开一项才能签发。签发结果交给 McpTokenReveal 显示一次。
import {useState} from 'react';
import {Switch} from '../ui/Switch';
import {SCOPE_LABELS, SCOPE_ORDER} from './scopes';

export function McpIssueForm({busy, onIssue, onCancel}: {
  busy: boolean; onIssue: (name: string, scopes: string[]) => void; onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const toggle = (s: string) => setScopes(scopes.includes(s) ? scopes.filter(x => x !== s) : [...scopes, s]);
  const valid = !!name.trim() && scopes.length > 0;
  return <form className="mcp-form" onSubmit={e => { e.preventDefault(); if (valid && !busy) onIssue(name.trim(), scopes); }}>
    <label className="mcp-field"><span>名称</span>
      <input value={name} maxLength={40} placeholder="如：采购 Agent" onChange={e => setName(e.target.value)}/>
    </label>
    <div className="mcp-scopes" role="group" aria-label="权限">
      {SCOPE_ORDER.map(s => <div key={s} className="mcp-scope">
        <span>{SCOPE_LABELS[s]}<small>{s}</small></span>
        <Switch on={scopes.includes(s)} onToggle={() => toggle(s)} label={SCOPE_LABELS[s]}/>
      </div>)}
    </div>
    <div className="inline-actions">
      <button type="submit" className="primary" disabled={!valid || busy}>{busy ? '正在签发…' : '签发令牌'}</button>
      <button type="button" className="quiet" disabled={busy} onClick={onCancel}>取消</button>
    </div>
  </form>;
}
