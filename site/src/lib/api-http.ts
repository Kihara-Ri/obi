// 「接口」页 B 面：HTTP 鉴权与调用方式、错误码、对外接口（调用方令牌）。应用内部接口在 api-app.ts。
// 与 server/routes.py（路由表）、server/http.py（鉴权与分发）、docs/HTTP接口一览.md 同步；改一处要改另一处。
export interface Route {
  m: 'GET' | 'POST';
  p: string;
  does: string;
  auth?: string;   // 不写 = 所在分组的默认凭据
  q?: string;      // 查询参数；* 为必填
  body?: string;   // JSON 请求体字段；* 为必填
  ret?: string;
}
export interface Group { id: string; title: string; lead?: string; routes: Route[] }

export const curl = 'curl -H "Authorization: Bearer obi_client_…" \\\n  "https://your.domain/api/collection/purchases?by=catalogNumber&q=WPCR-0001"';

export const login = 'curl -c jar -H "Content-Type: application/json" \\\n  -d \'{"password": "…"}\' https://your.domain/api/login\ncurl -b jar https://your.domain/api/state';

export const conventions = [
  { k: '令牌', v: 'Authorization: Bearer obi_client_…；只开对外接口，权限同 A 面。' },
  { k: '会话', v: 'POST /api/login 换 album_session Cookie，用于应用接口；设了登录密码才需要，对公网开放时必须设。' },
  { k: '请求', v: 'POST 一律 application/json，请求体不超过 50 MB；整文件上传用 application/zip 或 octet-stream。' },
  { k: '来源', v: 'Host 必须是本机或配置的公网地址；带 Origin 时须同源，跨站请求一律 403。' },
  { k: '数值', v: '金额是人民币字符串，日期 YYYY-MM-DD；成本缺失为 null，不当 0。' },
];

export const errors = [
  { k: '400', v: '参数无效或模块关闭' },
  { k: '401', v: '未登录、令牌缺失或无效' },
  { k: '403', v: '令牌缺这项权限、跨站或地址未配置' },
  { k: '404', v: '接口不存在，或没有调用方具有这项权限' },
  { k: '409', v: '版本或绑定冲突，核对后再提交' },
  { k: '413', v: '上传文件为空或超限' },
  { k: '415', v: '请求类型不对' },
  { k: '503', v: '数据库或外部资料源暂不可用' },
];

const q = 'q*（1–200 字）· by（text · catalogNumber · barcode）· offset';

export const open: Group = {
  id: 'http-open', title: '对外接口', lead: '调用方令牌。每项标出所需权限；上架与交易另需开启二手交易。',
  routes: [
    { m: 'GET', p: '/api/health', auth: '免登录', does: '存活与版本探测，给部署脚本和监控。', ret: 'ok · version · schema · uptime；数据库不可用时 503' },
    { m: 'GET', p: '/api/collection/purchases', auth: 'collection:read', does: '查有买入依据的副本，含交易历史；不含金额。每页 20 条。',
      q: `${q} · status（held · in_transit · sale_pending · resold · removed）`, ret: 'copies[]（艺人、专辑、状态、版本与发行资料）· nextOffset' },
    { m: 'GET', p: '/api/listing/agent/package', auth: 'listing:read', does: '不带 id：在国内、海外库存里找副本，每页 20 条。', q, ret: 'copies[]（id、版本、编号、条码、listed）· nextOffset' },
    { m: 'GET', p: '/api/listing/agent/package?id=', auth: 'listing:read', does: '带 id：打包这张副本的发行资料与有序原图。',
      q: 'id* · photos=0（只要资料）· order（逗号分隔，需同时给 photoRevision）· photoRevision', ret: 'ZIP：materials.json + photos/01.jpg…' },
    { m: 'POST', p: '/api/listing/agent/receipts', auth: 'trading:write', does: '登记已核实在线的闲鱼商品，副本标为已上架。可原样重试。',
      body: 'id* · revision* · itemId* · status*（online）· price* · shipping*（mode：free · fixed + amount · actual · pickup）· verifiedAt*', ret: '回执 · revision · url · listed' },
    { m: 'POST', p: '/api/trading/agent/orders', auth: 'trading:write', does: '登记已付款订单，副本进入售出中。',
      body: 'orderId* · itemId* · date* · gross* · fees · postage', ret: 'saleId · orderId · status · buyerReceived · settledDate' },
    { m: 'POST', p: '/api/trading/agent/settlements', auth: 'trading:write', does: '回报买家收货与实际到账，两项齐全后按到账日期入账。订单未登记时 409。',
      body: 'orderId* · buyerReceived · settledDate', ret: '同上' },
    { m: 'GET', p: '/api/insight/profile', auth: 'insight:read', does: '近期加权的买卖画像：成本模型、周转天数、利润排行。',
      q: 'halfLifeDays（60–720，默认 180）', ret: 'asOf · weighting · costModel · turnover · top' },
    { m: 'POST', p: '/api/insight/evaluate', auth: 'insight:read', does: '一次评估 1–50 条网站候选，不保存候选。',
      body: 'candidates*（ref* · catalogNumber · barcode · artist · title · format · price · currency · shippingToWarehouse）· halfLifeDays', ret: 'asOf · weighting · results[]' },
    { m: 'GET', p: '/api/insight/releases', auth: 'insight:read', does: '单条候选的查询串版本。', q: '候选字段（不要 ref）· halfLifeDays', ret: 'results 中的一条' },
    { m: 'POST', p: '/mcp', auth: '任一权限', does: 'MCP 入口（JSON-RPC），见 A 面。' },
    { m: 'GET', p: '/api/mcp/package', auth: '链接签名', does: 'get_listing_package 给出的 10 分钟下载链接。', q: 't*（签名）', ret: 'ZIP；签名无效 403，副本或照片变了 409' },
  ],
};
