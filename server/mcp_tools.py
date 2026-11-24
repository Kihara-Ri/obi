"""MCP 工具表（D-051）：每个工具对应一个现有对外接口，直接调用它的处理函数，不另写业务逻辑。

工具按权限归组；tools/list 只列出令牌拥有的权限下的工具。参数校验仍由原处理函数负责，
这里的 JSON Schema 只是给 Agent 的说明。
"""
from urllib.parse import urlencode

from .collection_api import api_purchased_copies
from .insight_api import api_insight_evaluate, api_insight_profile
from .listing_agent import api_agent_package, package_preview
from .mcp_files import link
from .trading_agent import api_listing_receipt, api_order_settlement, api_paid_order

READ = {'readOnlyHint': True, 'openWorldHint': False}
WRITE = {'readOnlyHint': False, 'destructiveHint': False, 'idempotentHint': True, 'openWorldHint': False}
MONEY = {'type': 'string', 'pattern': r'^\d+(\.\d{1,2})?$', 'description': '人民币金额字符串，最多两位小数'}
DAY = {'type': 'string', 'format': 'date', 'description': 'YYYY-MM-DD'}
BY = {'type': 'string', 'enum': ['text', 'catalogNumber', 'barcode'], 'default': 'text',
      'description': 'text 按艺人与专辑名；catalogNumber 唱片编号；barcode 条码'}
HALF_LIFE = {'type': 'integer', 'minimum': 60, 'maximum': 720, 'default': 180,
             'description': '近期加权的半衰期（天）：越小越看重最近的买卖'}
CANDIDATE = {'type': 'object', 'additionalProperties': False, 'required': ['ref'], 'properties': {
    'ref': {'type': 'string', 'description': '你给这条候选起的编号，结果按它对应（如网站商品号）'},
    'catalogNumber': {'type': 'string'}, 'barcode': {'type': 'string'},
    'artist': {'type': 'string'}, 'title': {'type': 'string'},
    'format': {'type': 'string', 'description': 'CD、LP 等；不给时按介质分开返回历史'},
    'price': {'type': 'string', 'description': '网站标价（数字字符串）'},
    'currency': {'type': 'string', 'enum': ['JPY', 'CNY']},
    'shippingToWarehouse': {'type': 'string', 'description': '寄到集运仓的运费，与标价同币种'}}}


def obj(properties, required=()):
    return {'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': list(required)}


class Capture:
    """把原处理函数的 h.send 接住，供工具返回。"""

    def __init__(self, path, headers):
        self.path, self.headers, self.status, self.data = path, headers, None, None

    def send(self, data, status=200, **_):
        self.status, self.data = status, data


def get(fn, path):
    def run(h, svc, args):
        params = {k: (','.join(map(str, v)) if isinstance(v, list) else str(v)) for k, v in args.items() if v is not None}
        call = Capture(path + '?' + urlencode(params), h.headers)
        fn(call, svc)
        return call
    return run


def post(fn):
    def run(h, svc, args):
        call = Capture(h.path, h.headers)
        fn(call, svc, args)
        return call
    return run


def listing_package(h, svc, args):
    params = {'id': args.get('id')}
    if args.get('photos') is False:
        params['photos'] = '0'
    if args.get('order') is not None:
        params['order'] = ','.join(map(str, args['order']))
    if args.get('photoRevision') is not None:
        params['photoRevision'] = str(args['photoRevision'])
    manifest = package_preview(svc.store, params)
    manifest['download'] = link(h, svc, manifest['id'], manifest['photoOrder'], manifest['photoRevision'])
    call = Capture(h.path, h.headers)
    call.send(manifest)
    return call


def tool(name, title, scope, description, schema, run, hints, lock=False):
    return {'name': name, 'title': title, 'scope': scope, 'description': description,
            'inputSchema': schema, 'annotations': {'title': title, **hints}, 'run': run, 'lock': lock}


TOOLS = [
    tool('get_purchase_profile', '读采购画像', 'insight:read',
         '采购开工前读一次：当前与实付日元汇率、按 CD/LP 的每张国际运费与整批费用、国内寄出运费、平台扣费率、'
         '周转天数、近期最赚钱的艺人与厂牌。统计按日期近期加权，只给汇总。',
         obj({'halfLifeDays': HALF_LIFE}), get(api_insight_profile, '/api/insight/profile'), READ),
    tool('evaluate_candidates', '评估采购候选', 'insight:read',
         '把唱片网站上的 1–50 条候选交给 Obi：是否已有（在库/在途）、同版本或同专辑的历史成本与净收入、'
         '落地成本拆分与预计利润。尽量给唱片编号或条码、介质和标价。只有 1 条样本时金额为区间；'
         '没卖过时预计利润为 null，请用外部行情补。Obi 不保存候选。',
         obj({'candidates': {'type': 'array', 'minItems': 1, 'maxItems': 50, 'items': CANDIDATE},
              'halfLifeDays': HALF_LIFE}, ['candidates']), post(api_insight_evaluate), READ),
    tool('find_purchases', '查已购唱片', 'collection:read',
         '买之前查是否已经有：按艺人/专辑名、唱片编号或条码查有买入依据的副本。status 为 held（在库）或 '
         'in_transit（在途）说明已有；sale_pending、resold、removed 是买过但已卖出或移除。不含金额。每页 20 条。',
         obj({'q': {'type': 'string', 'minLength': 1, 'maxLength': 200}, 'by': BY,
              'status': {'type': 'string', 'enum': ['held', 'in_transit', 'sale_pending', 'resold', 'removed']},
              'offset': {'type': 'integer', 'minimum': 0}}, ['q']),
         get(api_purchased_copies, '/api/collection/purchases'), READ),
    tool('find_listing_copies', '查可上架的副本', 'listing:read',
         '闲鱼上架第一步：在国内与海外库存里找要卖的那一张，返回副本 id、版本、是否已上架。每页 20 条。',
         obj({'q': {'type': 'string', 'minLength': 1, 'maxLength': 200}, 'by': BY,
              'offset': {'type': 'integer', 'minimum': 0}}, ['q']),
         get(api_agent_package, '/api/listing/agent/package'), READ),
    tool('get_listing_package', '取上架资料', 'listing:read',
         '返回副本的发行资料、实物资料、照片顺序和 revision（登记上架回执要用），以及 10 分钟内有效的 ZIP 下载链接'
         '（materials.json + 按顺序编号的原图，不需令牌）。不含成本、渠道和私人备注；品相只以照片和确认过的实物信息为准。'
         '换图或调顺序时同时给 order 和当前 photoRevision；photos=false 只要资料。',
         obj({'id': {'type': 'string', 'pattern': '^[0-9a-f]{32}$'}, 'photos': {'type': 'boolean', 'default': True},
              'order': {'type': 'array', 'items': {'type': 'integer', 'minimum': 0}},
              'photoRevision': {'type': 'integer', 'minimum': 0}}, ['id']), listing_package, READ),
    tool('record_listing_receipt', '登记上架回执', 'trading:write',
         '闲鱼商品发布后、回读确认在线，再登记：副本标记为已上架并保存商品链接。revision 用 get_listing_package '
         '返回的最新值。运费 mode 为 free、fixed（带 amount）、actual 或 pickup。可原样重试，返回同一结果。',
         obj({'id': {'type': 'string', 'pattern': '^[0-9a-f]{32}$'}, 'revision': {'type': 'integer'},
              'itemId': {'type': 'string', 'description': '闲鱼商品号'}, 'status': {'type': 'string', 'enum': ['online']},
              'price': MONEY, 'shipping': obj({'mode': {'type': 'string', 'enum': ['free', 'fixed', 'actual', 'pickup']},
                                               'amount': MONEY}, ['mode']),
              'verifiedAt': {'type': 'string', 'format': 'date-time', 'description': '回读确认在线的时间，带时区'}},
             ['id', 'revision', 'itemId', 'status', 'price', 'shipping', 'verifiedAt']),
         post(api_listing_receipt), WRITE, lock=True),
    tool('record_paid_order', '登记已付款订单', 'trading:write',
         '买家付款后登记：以闲鱼订单号为键建立「售出中」销售单。gross 是实际成交价，fees 平台扣费，postage 卖家付的'
         '寄出运费（省略为 0）。同号同内容可重试。',
         obj({'orderId': {'type': 'string'}, 'itemId': {'type': 'string'}, 'date': DAY,
              'gross': MONEY, 'fees': MONEY, 'postage': MONEY}, ['orderId', 'itemId', 'date', 'gross']),
         post(api_paid_order), WRITE, lock=True),
    tool('record_settlement', '同步收货与到账', 'trading:write',
         '回报已核实的买家收货（buyerReceived）和实际到账日期（settledDate），可分次、任意顺序；两项齐全后按到账日期'
         '入账为「已交易」。订单还没登记时会冲突：先 record_paid_order 再重试。',
         obj({'orderId': {'type': 'string'}, 'buyerReceived': {'type': 'boolean'},
              'settledDate': DAY}, ['orderId']), post(api_order_settlement), WRITE, lock=True),
]
BY_NAME = {t['name']: t for t in TOOLS}


def visible(scopes):
    return [t for t in TOOLS if t['scope'] in scopes]


def describe(t):
    return {k: t[k] for k in ('name', 'title', 'description', 'inputSchema', 'annotations')}
