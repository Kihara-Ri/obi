// 「接口」页 A 面：MCP 接入、权限、工具与场景模板。
// 与 server/mcp_tools.py（工具名、权限、参数）、server/mcp_prompts.py（模板）、docs/MCP接入.md 同步；改一处要改另一处。
export interface Field { k: string; v: string; need?: boolean }
export interface Tool { name: string; title: string; scope: string; write?: boolean; http: string; does: string; args: Field[]; ret: string }
export interface ToolGroup { id: string; title: string; tools: Tool[] }
export interface Prompt { name: string; title: string; scopes: string; args: string }

export const scopes = [
  { name: 'listing:read', can: '查库存、取资料包', needs: '二手交易' },
  { name: 'trading:write', can: '回执、订单、到账', needs: '二手交易' },
  { name: 'collection:read', can: '已购查询（不含金额）', needs: '' },
  { name: 'insight:read', can: '采购评估', needs: '' },
];

export const issue = 'docker compose exec app python3 -m server.client_admin \\\n  add 上架Agent --scope listing:read --scope trading:write';

export const clients = [
  { id: 'claude', label: 'Claude Code', code: 'claude mcp add --transport http obi https://your.domain/mcp \\\n  --header "Authorization: Bearer obi_client_…"' },
  { id: 'codex', label: 'Codex CLI', code: 'codex mcp add obi --url https://your.domain/mcp \\\n  --bearer-token-env-var OBI_MCP_TOKEN' },
  { id: 'json', label: 'Cursor / VS Code', code: '{"mcpServers": {"obi": {"type": "http",\n  "url": "https://your.domain/mcp",\n  "headers": {"Authorization": "Bearer obi_client_…"}}}}' },
  { id: 'remote', label: '只认本机命令', code: '{"mcpServers": {"obi": {"command": "npx",\n  "args": ["-y", "mcp-remote", "https://your.domain/mcp",\n    "--header", "Authorization:Bearer obi_client_…"]}}}' },
];

const by: Field = { k: 'by', v: 'text · catalogNumber · barcode，默认 text' };
const halfLife: Field = { k: 'halfLifeDays', v: '60–720，默认 180：近期加权的半衰期（天）' };
const id: Field = { k: 'id', v: '副本 id（32 位十六进制）', need: true };
const money = '人民币字符串，最多两位小数';

export const toolGroups: ToolGroup[] = [
  {
    id: 'mcp-insight', title: '采购评估',
    tools: [
      { name: 'get_purchase_profile', title: '读采购画像', scope: 'insight:read', http: 'GET /api/insight/profile',
        does: '开工前读一次：汇率、按 CD / LP 的国际运费与整批费用、国内运费、平台扣费率、周转天数、近期最赚钱的艺人与厂牌。',
        args: [halfLife], ret: 'asOf · weighting · costModel · turnover · top' },
      { name: 'evaluate_candidates', title: '评估采购候选', scope: 'insight:read', http: 'POST /api/insight/evaluate',
        does: '一次 1–50 条网站候选：是否已有、同版本或同专辑的历史成本与净收入、落地成本与预计利润。Obi 不保存候选。',
        args: [
          { k: 'candidates', v: '1–50 条：ref（必填，结果按它对应）、catalogNumber、barcode、artist、title、format、price、currency（JPY · CNY）、shippingToWarehouse', need: true },
          halfLife,
        ], ret: 'asOf · weighting · results[]；没卖过时预计利润为 null' },
    ],
  },
  {
    id: 'mcp-purchases', title: '买前查重复',
    tools: [
      { name: 'find_purchases', title: '查已购唱片', scope: 'collection:read', http: 'GET /api/collection/purchases',
        does: '按艺人 / 专辑名、唱片编号或条码查有买入依据的副本。held、in_transit 说明已有。不含金额，每页 20 条。',
        args: [{ k: 'q', v: '1–200 字', need: true }, by, { k: 'status', v: 'held · in_transit · sale_pending · resold · removed' }, { k: 'offset', v: '分页位置' }],
        ret: 'copies[] · nextOffset' },
    ],
  },
  {
    id: 'mcp-listing', title: '闲鱼上架到入账',
    tools: [
      { name: 'find_listing_copies', title: '查可上架的副本', scope: 'listing:read', http: 'GET /api/listing/agent/package?q=…',
        does: '在国内与海外库存里找要卖的那一张。每页 20 条。',
        args: [{ k: 'q', v: '1–200 字', need: true }, by, { k: 'offset', v: '分页位置' }],
        ret: 'copies[]（id、版本、是否已上架）· nextOffset' },
      { name: 'get_listing_package', title: '取上架资料', scope: 'listing:read', http: 'GET /api/listing/agent/package?id=…',
        does: '发行与实物资料、照片顺序和 revision，另给 10 分钟有效的 ZIP 链接（不需令牌）。不含成本、渠道和私人备注。',
        args: [id, { k: 'photos', v: 'false 只要资料，默认 true' }, { k: 'order', v: '照片序号数组，需同时给 photoRevision' }, { k: 'photoRevision', v: '当前照片版本' }],
        ret: '清单 · download.url · expiresAt' },
      { name: 'record_listing_receipt', title: '登记上架回执', scope: 'trading:write', write: true, http: 'POST /api/listing/agent/receipts',
        does: '商品发布并回读确认在线后登记：副本标为已上架，存下商品链接。可原样重试。',
        args: [id, { k: 'revision', v: 'get_listing_package 的最新值', need: true }, { k: 'itemId', v: '闲鱼商品号', need: true }, { k: 'status', v: 'online', need: true },
          { k: 'price', v: money, need: true }, { k: 'shipping', v: 'mode：free · fixed（带 amount）· actual · pickup', need: true }, { k: 'verifiedAt', v: '回读确认的时间，带时区', need: true }],
        ret: '回执 · revision · url · listed' },
      { name: 'record_paid_order', title: '登记已付款订单', scope: 'trading:write', write: true, http: 'POST /api/trading/agent/orders',
        does: '买家付款后，以闲鱼订单号为键建立「售出中」销售单。同号同内容可重试。',
        args: [{ k: 'orderId', v: '闲鱼订单号', need: true }, { k: 'itemId', v: '闲鱼商品号', need: true }, { k: 'date', v: 'YYYY-MM-DD', need: true },
          { k: 'gross', v: `实际成交价，${money}`, need: true }, { k: 'fees', v: '平台扣费' }, { k: 'postage', v: '卖家付的寄出运费，省略为 0' }],
        ret: 'saleId · orderId · status · buyerReceived · settledDate' },
      { name: 'record_settlement', title: '同步收货与到账', scope: 'trading:write', write: true, http: 'POST /api/trading/agent/settlements',
        does: '回报核实过的收货与到账，可分次、任意顺序；两项齐全后按到账日期入账为「已交易」。订单未登记时冲突。',
        args: [{ k: 'orderId', v: '闲鱼订单号', need: true }, { k: 'buyerReceived', v: 'true' }, { k: 'settledDate', v: 'YYYY-MM-DD' }],
        ret: '同上：status 为 complete 即已交易' },
    ],
  },
];

export const prompts: Prompt[] = [
  { name: 'xianyu_listing', title: '闲鱼上架到入账', scopes: 'listing:read + trading:write', args: 'record：要卖的唱片' },
  { name: 'check_before_buying', title: '买前查重复', scopes: 'collection:read', args: 'record：一张或多张' },
  { name: 'purchase_scouting', title: '采购时挑出值得买的', scopes: 'insight:read', args: 'source：网站或页面 · budget（可选）' },
];

export const protocol = [
  { k: '传输', v: '无状态 Streamable HTTP，只回 application/json；GET /mcp 返回 405，不开 SSE。' },
  { k: '版本', v: '2026-07-28（server/discover）；旧客户端经 initialize 协商 2025-11-25、2025-06-18、2025-03-26。' },
  { k: '方法', v: 'ping · tools/list · tools/call · prompts/list · prompts/get；只列令牌权限内的工具与模板。' },
  { k: '出错', v: '工具失败回 isError 与中文原因；「冲突：」开头时停下交给人核对，不要改数据重试。' },
  { k: '鉴权', v: '没有任何调用方 404，令牌缺失或无效 401；Host 与 Origin 校验同 HTTP。' },
];
