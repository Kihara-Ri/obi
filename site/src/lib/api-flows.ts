// 「接口」页的数据：四项权限与按使用场景排列的调用步骤。
// 与 docs/接口场景指南.md 保持一致，改一处要同步另一处；字段细节以 docs 里的接口契约为准。
export interface Scope { name: string; can: string; needs: string }
export interface Step {
  title: string;
  who: 'Agent' | '外部系统' | 'Obi';
  method?: 'GET' | 'POST';
  path?: string;
  token?: string;
  note: string;
  result?: string;
  body?: string;
}
export interface Flow { id: string; title: string; sub: string; steps: Step[] }

export const scopes: Scope[] = [
  { name: 'listing:read', can: '查找库存、下载资料包', needs: '二手交易' },
  { name: 'trading:write', can: '回执、订单、到账', needs: '二手交易' },
  { name: 'collection:read', can: '查询已购副本（不含金额）', needs: '无' },
  { name: 'insight:read', can: '采购评估：成本与利润汇总', needs: '无' },
];

export const issue = 'docker compose exec obi python3 -m server.client_admin \\\n  add 上架Agent --scope listing:read --scope trading:write';

const pkg = '/api/listing/agent/package';

export const flows: Flow[] = [
  {
    id: 'listing',
    title: '闲鱼上架到入账',
    sub: 'Agent 写文案、发布、跟单；Obi 提供资料，接收核实过的事实并记账。',
    steps: [
      { title: '找到要卖的那一张', who: 'Agent', method: 'GET', path: `${pkg}?by=catalogNumber&q=…`, token: 'listing:read', note: '按名称、编号或条码搜索库存，每页 20 项。', result: '候选副本 id' },
      { title: '下载资料包', who: 'Agent', method: 'GET', path: `${pkg}?id=…`, token: 'listing:read', note: '发行资料、副本信息和按顺序编号的原图；不含成本与备注。', result: 'ZIP：materials.json + photos/', body: 'materials.json\n  id, revision, photoRevision\n  album / release / copy\nphotos/01.jpg, 02.jpg …' },
      { title: '发布并核实在线', who: '外部系统', note: '文案、选图、定价、发布都在 Obi 之外；发布后回读商品页确认在线。' },
      { title: '登记上架回执', who: 'Agent', method: 'POST', path: '/api/listing/agent/receipts', token: 'trading:write', note: '带资料包里的 revision；一件闲鱼商品只绑一张副本。', result: '已上架', body: '{"id": "…", "revision": 2,\n "itemId": "100000000001", "status": "online",\n "price": "95.00", "shipping": {"mode": "free"},\n "verifiedAt": "2026-10-08T05:30:00Z"}' },
      { title: '买家付款', who: 'Agent', method: 'POST', path: '/api/trading/agent/orders', token: 'trading:write', note: '以闲鱼订单号为键，成交价、平台扣费、寄出运费分开记。', result: '售出中', body: '{"orderId": "DEMO-XIANYU-001",\n "itemId": "100000000001", "date": "2026-10-09",\n "gross": "90.00", "fees": "3.00", "postage": "7.00"}' },
      { title: '收货与到账', who: 'Agent', method: 'POST', path: '/api/trading/agent/settlements', token: 'trading:write', note: '两项可分次、任意顺序提交；订单未登记时返回 409。', result: '两项齐全 → 已交易', body: '{"orderId": "DEMO-XIANYU-001",\n "buyerReceived": true, "settledDate": "2026-10-14"}' },
    ],
  },
  {
    id: 'purchases',
    title: '买前查重复',
    sub: '下单前确认架上是不是已经有这一版；不需要开启任何模块。',
    steps: [
      { title: '按编号或名称查询', who: 'Agent', method: 'GET', path: '/api/collection/purchases?by=catalogNumber&q=…', token: 'collection:read', note: '只返回发行资料与副本状态，不含金额、渠道和照片。', result: '有买入依据的副本' },
      { title: '看状态下结论', who: 'Agent', note: 'held 在库、in_transit 在途说明已经有了；sale_pending、resold、removed 是买过但已卖出或移除。按名称查到的候选再用编号、条码核对版本。' },
    ],
  },
  {
    id: 'insight',
    title: '采购时挑出值得买的',
    sub: 'Agent 在唱片网站挑货，用你自己的买卖证据估算落地成本和预计利润；排序与下单在 Obi 之外。',
    steps: [
      { title: '读买卖画像', who: 'Agent', method: 'GET', path: '/api/insight/profile', token: 'insight:read', note: '汇率、按 CD / LP 分开的国际运费与整批费用、平台扣费、周转天数、利润排行；近期的买卖权重更高。', result: '成本模型与偏好' },
      { title: '抓一页候选', who: 'Agent', note: '在唱片网站上抓商品，尽量带上唱片编号或条码、介质和标价。' },
      { title: '批量评估', who: 'Agent', method: 'POST', path: '/api/insight/evaluate', token: 'insight:read', note: '一次 1–50 条。只有一笔样本时金额给区间；没卖过时预计利润为空，由 Agent 用外部行情补。', result: '是否已有、历史、落地成本、预计利润', body: '{"candidates": [{"ref": "shop-123",\n  "catalogNumber": "WPCR-0001", "format": "CD",\n  "price": "1980", "currency": "JPY"}]}' },
      { title: '排出短名单', who: 'Agent', note: '结合外部行情，按预计利润、周转和样本数排序，附链接和理由交给你；你自己下单，到货录入后自动进入下一次评估。' },
    ],
  },
  {
    id: 'health',
    title: '部署与监控',
    sub: '部署脚本和外部监控用它判断实例是否健康。',
    steps: [
      { title: '健康检查', who: '外部系统', method: 'GET', path: '/api/health', note: '免登录；数据库不可用时返回 503。', result: 'ok、version、schema、uptime' },
    ],
  },
];

export const rules = [
  { k: '404', v: '没有调用方具有这项权限' },
  { k: '401', v: '令牌无效' },
  { k: '403', v: '令牌缺少这项权限' },
  { k: '400', v: '参数无效或模块关闭' },
  { k: '409', v: '版本或绑定冲突，核对后再提交' },
];
