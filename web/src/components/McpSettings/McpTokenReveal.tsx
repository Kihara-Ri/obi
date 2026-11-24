// MCP 服务 · 刚签发或轮换的令牌：只显示这一次（服务器只存摘要），附 Claude Code 连接命令。点「完成」后清掉。
import {CopyButton} from '../CopyButton';
import {connectCommand} from './scopes';

export function McpTokenReveal({name, token, url, onDone}: {name: string; token: string; url: string; onDone: () => void}) {
  const command = connectCommand(url, token);
  return <div className="mcp-reveal" role="status">
    <p><strong>{name}</strong> 的令牌只显示这一次</p>
    <div className="mcp-code"><code>{token}</code><CopyButton text={token} label="复制令牌"/></div>
    <p>Claude Code 连接命令</p>
    <div className="mcp-code"><code>{command}</code><CopyButton text={command} label="复制连接命令"/></div>
    <div className="inline-actions"><button type="button" className="primary" onClick={onDone}>完成</button></div>
  </div>;
}
