"""Financial command preparation: fetch before locks; immutable quote basis at commit."""
from contextlib import closing
from datetime import date
from decimal import Decimal, InvalidOperation
from domain import ValidationError, day, number


def valid_basis(quote, requested):
    try:
        return (quote.get('requestedDate') == requested and requested <= date.today().isoformat()
                and quote.get('status') in ('exact', 'previous')
                and 0 <= (date.fromisoformat(requested) - date.fromisoformat(quote['quoteDate'])).days <= 14
                and Decimal(quote['rate']).is_finite() and Decimal(quote['rate']) > 0)
    except (AttributeError, KeyError, TypeError, ValueError, InvalidOperation): return False


def shipment_money(before, data):
    currency = data.get('currency') or before.get('currency') or 'CNY'
    when = day(data.get('date', before['date']), '发货日期')
    reprice = 'cost' in data or 'currency' in data or currency == 'JPY' and when != before['date']
    original = number(data['cost'], '运费') if 'cost' in data else Decimal(before.get('costOriginal') or before['cost'])
    return currency, when, reprice, original


def prepare(store, kind, data):
    store.require_module('circulation' if kind in ('ship', 'update_shipment') else 'trading')
    before, basis = None, None
    if kind in ('update_shipment', 'update_sale'):
        table = 'shipments' if kind == 'update_shipment' else 'sales'
        with closing(store.connect()) as db: before = store.get(db, table, data.get('id'))
    if kind == 'ship':
        currency, when = data.get('currency') or 'CNY', day(data.get('date'), '发货日期')
        needs = number(data.get('cost', 0), '运费') != 0
    elif kind == 'update_shipment':
        currency, when, reprice, original = shipment_money(before, data)
        needs = reprice and original != 0
    elif kind == 'sell':
        currency, when = data.get('currency') or 'CNY', day(data.get('date'), '售出日期')
        needs = any(number(data.get(k, 0), k) != 0 for k in ('gross', 'fees', 'postage'))
    else:
        currency, when = before.get('currency') or 'CNY', before['date']
        needs = any(k in data and number(data[k], k) != Decimal(str(before.get(k + 'Original' if currency == 'JPY' else k) or 0))
                    for k in ('fees', 'postage'))
        if valid_basis(before.get('rateQuote'), when): basis = before['rateQuote']
    if currency not in ('CNY', 'JPY'): raise ValidationError('币种不支持')
    if currency == 'JPY' and needs:
        if when > date.today().isoformat(): raise ValidationError('未来日期汇率未知，不能自动折算日元金额')
        if basis is None and store.rates: basis = store.rates.resolve(when)
        if not valid_basis(basis, when): raise ValidationError('暂无可靠汇率，无法折算日元金额；可直接填人民币金额')
    return {'before': before, 'quote': basis, 'frozen': bool(before and basis is before.get('rateQuote'))}


def check(store, prepared, current=None):
    if prepared['before'] is not None and current != prepared['before']:
        raise ValidationError('单据已变更，请重新打开后保存')
    basis = prepared['quote']
    if basis and not prepared['frozen']:
        live = store.rates.quote(basis['requestedDate'])
        if live != basis: raise ValidationError('汇率已更新或过期，请重试；输入内容仍保留')
