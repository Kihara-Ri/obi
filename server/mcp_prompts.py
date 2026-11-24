"""MCP 提示模板（D-051）：把 docs/接口场景指南.md 的三个场景写成 Agent 可直接执行的步骤。

模板只按令牌权限列出；内容改动时同步场景指南与站点 site/src/lib/api-flows.ts。
"""
from domain import ValidationError

PROMPTS = [
    {'name': 'xianyu_listing', 'title': '闲鱼上架到入账', 'scopes': {'listing:read', 'trading:write'},
     'description': '从库存里找到一张唱片，取资料写文案发布到闲鱼，再把上架、付款、收货与到账同步回 Obi。',
     'arguments': [{'name': 'record', 'description': '要卖的唱片：编号、条码或艺人与专辑名', 'required': True}],
     'text': '''帮我把这张唱片上架到闲鱼：{record}

按顺序做，每一步用 Obi 的 MCP 工具：
1. find_listing_copies 找到它（有编号或条码时用 by=catalogNumber / barcode）。有多个副本时列出来让我选，不要自己挑。
2. get_listing_package 取资料，记下 revision；需要原图时用返回的 download.url 下载 ZIP（10 分钟内有效，过期重新调用）。
3. 根据资料写闲鱼文案并给出建议售价。品相只按照片和资料里确认过的实物信息写，不要编造。发布前把文案、价格、运费方式给我确认。
4. 我确认并发布后，回读商品页确认在线，再用 record_listing_receipt 登记（verifiedAt 用回读时间）。
5. 之后买家付款时用 record_paid_order，收货、到账核实后用 record_settlement。只登记核实过的事实；遇到冲突停下来告诉我，不要改数据重试。'''},
    {'name': 'check_before_buying', 'title': '买前查重复', 'scopes': {'collection:read'},
     'description': '买之前查我是否已经有这张，或以前买过。',
     'arguments': [{'name': 'record', 'description': '唱片编号、条码或艺人与专辑名；可以是多张', 'required': True}],
     'text': '''我在考虑买：{record}

用 find_purchases 逐张查（有编号或条码时优先用 by=catalogNumber / barcode，按名称查到的再用编号、介质核对版本）。
每张告诉我：已有（held / in_transit，几张）、买过但已卖出或移除，还是没有记录；名称匹配但版本不确定的要单独标出。'''},
    {'name': 'purchase_scouting', 'title': '采购时挑出值得买的', 'scopes': {'insight:read'},
     'description': '在唱片网站上挑货：用我的买卖历史估算落地成本和预计利润，排出短名单。',
     'arguments': [{'name': 'source', 'description': '要浏览的网站、店铺或页面链接', 'required': True},
                   {'name': 'budget', 'description': '预算或数量上限（可选）', 'required': False}],
     'text': '''帮我在这里挑值得买的唱片：{source}
预算或数量：{budget}

1. 先调 get_purchase_profile，了解我的成本模型、周转和近期赚钱的艺人与厂牌。
2. 浏览页面，抓下候选的标价、币种、唱片编号或条码、介质（CD / LP）、艺人和专辑名，ref 用网站的商品号。
3. 每批最多 50 条交给 evaluate_candidates。已有在库的通常跳过，除非利润明显高。
4. 预计利润为 null 或样本很少时，用网站外的成交行情补足判断，并说明依据。
5. 按预计利润、利润率、周转和样本数排序，给我短名单：每条附链接、标价、落地成本、预计利润和一句理由。
不要下单或加购物车，由我自己决定。'''},
]
BY_NAME = {p['name']: p for p in PROMPTS}


def visible(scopes):
    return [p for p in PROMPTS if p['scopes'] <= scopes]


def describe(p):
    return {k: p[k] for k in ('name', 'title', 'description', 'arguments')}


def render(p, arguments):
    values = {a['name']: str((arguments or {}).get(a['name']) or '').strip() for a in p['arguments']}
    missing = [a['name'] for a in p['arguments'] if a['required'] and not values[a['name']]]
    if missing:
        raise ValidationError('缺少参数：' + '、'.join(missing))
    text = p['text'].format(**{k: v or '未指定' for k, v in values.items()})
    return {'description': p['description'], 'messages': [{'role': 'user', 'content': {'type': 'text', 'text': text}}]}
