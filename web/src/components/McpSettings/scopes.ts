// 调用方权限的中文名与顺序（与 server/agent_clients.py 的 SCOPES 一致，见 D-050）。
export const SCOPE_LABELS: Record<string, string> = {
  'insight:read': '采购评估',
  'collection:read': '查已购',
  'listing:read': '上架资料',
  'trading:write': '交易入账',
};

export const SCOPE_ORDER = ['insight:read', 'collection:read', 'listing:read', 'trading:write'];

export type McpClient = {name: string; scopes: string[]; createdAt?: string};
export type McpState =
  | {available: false; reason: string}
  | {available: true; path: string; scopes: string[]; clients: McpClient[]; legacy: string[]};
export type Issued = McpState & {token: string; name: string};

export const scopeText = (scopes: string[]) =>
  SCOPE_ORDER.filter(s => scopes.includes(s)).map(s => SCOPE_LABELS[s]).join(' · ');

export const connectCommand = (url: string, token: string) =>
  `claude mcp add --transport http obi ${url} --header "Authorization: Bearer ${token}"`;
