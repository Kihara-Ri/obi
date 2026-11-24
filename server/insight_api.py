"""采购评估接口（D-049）：GET profile、POST evaluate、GET releases，需要 insight:read 权限。

只读、只返回汇总：不返回单条账本记录、副本 id、店铺、订单号与备注；不保存候选，不联网。
"""
from datetime import date
from decimal import Decimal, InvalidOperation

from domain import ValidationError
from .agent_auth import scope_guard
from .insight_data import days_between, load
from .insight_model import HELD, Model, days_median, ratio_median
from .insight_stats import DEFAULT_HALF_LIFE, n_eff, quantile, summary, trend
from .release_merge import _catnos, _code

MAX_CANDIDATES = 50
TOP = 10
FIELDS = {'ref', 'catalogNumber', 'barcode', 'artist', 'title', 'format', 'price', 'currency', 'shippingToWarehouse'}

authorize_insight = scope_guard('insight:read', '采购评估')


def half_life(value):
    try:
        days = int(value if value is not None else DEFAULT_HALF_LIFE)
    except (TypeError, ValueError):
        days = 0
    if not 60 <= days <= 720:
        raise ValidationError('halfLifeDays 需为 60–720 的整数')
    return days


def model(svc, days, today=None):
    as_of = today or date.today()
    rate = svc.rates.peek(as_of.isoformat()) if svc.rates else None
    return Model(load(svc.store), as_of, days, (rate, as_of.isoformat()) if rate else None)


def amount(value, label):
    try:
        number = Decimal(str(value))
    except InvalidOperation:
        number = None
    if number is None or not number.is_finite() or number < 0 or number > 10_000_000:
        raise ValidationError(f'{label}无效')
    return str(number)


def text(cand, key, limit):
    value = cand.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or len(value) > limit:
        raise ValidationError(f'{key} 需为不超过 {limit} 字的文本')
    return value.strip() or None


def clean_candidate(cand, need_ref=True):
    if not isinstance(cand, dict) or cand.keys() - FIELDS:
        raise ValidationError('候选只接受 ' + '、'.join(sorted(FIELDS)))
    out = {key: text(cand, key, 100 if key == 'ref' else 200) for key in FIELDS - {'price', 'shippingToWarehouse'}}
    if need_ref and not out['ref']:
        raise ValidationError('每条候选都需要 1–100 字的 ref')
    if out['catalogNumber']:
        numbers = _catnos(out['catalogNumber'])
        out['catalogNumber'] = next(iter(numbers)) if len(numbers) == 1 else None
    if out['barcode']:
        out['barcode'] = _code(out['barcode']) or None
    if not (out['catalogNumber'] or out['barcode'] or (out['artist'] and out['title']) or out['artist']):
        raise ValidationError(f"候选 {out['ref'] or ''} 需要唱片编号、条码或艺人".strip())
    if cand.get('price') is not None:
        out['price'] = amount(cand['price'], '标价')
        if out['currency'] not in ('JPY', 'CNY'):
            raise ValidationError('currency 只能是 JPY 或 CNY')
        out['shippingToWarehouse'] = amount(cand.get('shippingToWarehouse') or 0, '到仓运费')
    elif cand.get('shippingToWarehouse') is not None:
        raise ValidationError('给到仓运费时也需要标价')
    return out


def ranking(m, key, label):
    groups = {}
    for s in m.ledger.sales:
        name = getattr(s.record, key) if key == 'label' else s.record.artist_name
        if name and (w := m.w(s.date)):
            groups.setdefault((name, s.record.format), []).append((s, w))
    rows = []
    for (name, fmt), items in groups.items():
        profit = [(s.profit, w) for s, w in items if s.profit is not None]
        if len(profit) < 2:
            continue
        margin = [(s.profit / s.net, w) for s, w in items if s.profit is not None and s.net > 0]
        rows.append({label: name, 'format': fmt, 'sold': len(items), 'nEff': n_eff(profit),
                     'profitMedian': summary(profit), 'marginMedian': ratio_median(margin),
                     'trend': trend([(s.date, s.net, w) for s, w in items], m.as_of)})
    rows.sort(key=lambda r: (-Decimal(r['profitMedian']), -r['nEff']))
    return rows[:TOP]


def profile(m):
    sales, copies = m.ledger.sales, m.ledger.copies
    sell_days = [(d, m.w(s.date)) for s in sales if m.w(s.date) and (d := days_between(s.record.date, s.date)) is not None]
    stock = [d for c in copies if c.status in HELD and (d := days_between(c.date, m.as_of.isoformat())) is not None]
    counts = {}
    for c in copies:
        if m.w(c.date):
            entry = counts.setdefault(c.artist_name, {'artist': c.artist_name, 'bought': 0, 'held': 0})
            entry['bought'] += 1
            entry['held'] += c.status in HELD
    return {
        'asOf': m.as_of.isoformat(), 'weighting': m.weighting(), 'costModel': m.cost_model,
        'turnover': {'daysToSell': {'median': days_median(sell_days), 'n': len(sell_days)},
                     'inStockDays': {'median': int(quantile([(d, 1) for d in stock], .5)) if len(stock) >= 2 else None,
                                     'n': len(stock)}},
        'top': {'artistsByProfit': ranking(m, 'artist', 'artist'), 'labelsByProfit': ranking(m, 'label', 'label'),
                'artistsByCount': sorted(counts.values(), key=lambda r: (-r['bought'], r['artist'].casefold()))[:TOP]},
    }


def api_insight_profile(h, svc):
    from .routes import query
    params = query(h)
    if params.keys() - {'halfLifeDays'}:
        raise ValidationError('仅接受 halfLifeDays')
    h.send(profile(model(svc, half_life(params.get('halfLifeDays')))))


def api_insight_evaluate(h, svc, body):
    if body.keys() - {'candidates', 'halfLifeDays'}:
        raise ValidationError('仅接受 candidates 和 halfLifeDays')
    raw = body.get('candidates')
    if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_CANDIDATES:
        raise ValidationError(f'一次提交 1–{MAX_CANDIDATES} 条候选')
    candidates = [clean_candidate(c) for c in raw]
    if len({c['ref'] for c in candidates}) != len(candidates):
        raise ValidationError('候选的 ref 不能重复')
    m = model(svc, half_life(body.get('halfLifeDays')))
    h.send({'asOf': m.as_of.isoformat(), 'weighting': m.weighting(),
            'results': [m.evaluate(c) for c in candidates]})


def api_insight_release(h, svc):
    from .routes import query
    params = query(h)
    days = half_life(params.pop('halfLifeDays', None))
    h.send(model(svc, days).evaluate(clean_candidate(params, need_ref=False)))

