"""外部交易同步的输入契约。到账日期代表已经核实的到账事实。"""
from datetime import datetime, timezone
import re
from urllib.parse import parse_qs, urlsplit

from domain import ValidationError, day, money, number

CHANNEL = '闲鱼'
RECEIPT_PREFIX = 'xianyu-listing-receipt:'
ITEM_ID = r'[0-9]{1,32}'
ORDER_ID = r'[A-Za-z0-9][A-Za-z0-9._-]{0,79}'


def xianyu_channel(value):
    return isinstance(value, str) and value.strip().casefold() in (CHANNEL, 'xianyu', 'goofish')


def listing_url(item_id):
    return f'https://www.goofish.com/item?id={item_id}'


def listing_item_id(record):
    """兼容已手动录入的闲鱼链接，只解析本地字段。"""
    if record.get('listingChannel') and not xianyu_channel(record['listingChannel']):
        return None
    try:
        url = urlsplit(record.get('listingUrl') or '')
        if (url.scheme not in ('http', 'https')
                or url.netloc.lower() not in ('goofish.com', 'www.goofish.com', 'h5.m.goofish.com')
                or url.path.rstrip('/') != '/item'):
            return None
        ids = parse_qs(url.query, keep_blank_values=True).get('id', [])
        if len(ids) == 1 and re.fullmatch(ITEM_ID, ids[0]):
            return ids[0]
    except (ValueError, TypeError, AttributeError):
        return None
    return None


def _fields(data, required, optional=()):
    if not isinstance(data, dict) or not set(required) <= data.keys() or data.keys() - set(required) - set(optional):
        raise ValidationError('交易同步请求字段不完整或含未支持的字段')


def _identifier(value, pattern, label):
    if not isinstance(value, str) or not re.fullmatch(pattern, value):
        raise ValidationError(f'{label}格式无效')
    return value


def _amount(value, label):
    if not isinstance(value, str) or not re.fullmatch(r'[0-9]{1,10}(\.[0-9]{1,2})?', value):
        raise ValidationError(f'{label}应为人民币金额字符串，最多两位小数')
    return money(number(value, label))


def _trade_date(value, label):
    if not isinstance(value, str) or not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', value):
        raise ValidationError(f'{label}格式应为 YYYY-MM-DD')
    return day(value, label)


def _verified_at(value):
    if isinstance(value, str) and len(value) <= 40 and 'T' in value:
        if value.endswith('Z'):
            value = value[:-1] + '+00:00'
        try:
            timestamp = datetime.fromisoformat(value)
            if timestamp.tzinfo is not None:
                return timestamp.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
        except (ValueError, OverflowError):
            pass
    raise ValidationError('在线核对时间须为带时区的 ISO 8601 时间')


def _shipping(value):
    _fields(value, ('mode',), ('amount',))
    mode = value['mode']
    if mode == 'fixed' and 'amount' in value:
        return {'mode': mode, 'amount': _amount(value['amount'], '买家运费')}
    if mode in ('free', 'actual', 'pickup') and 'amount' not in value:
        return {'mode': mode}
    raise ValidationError('运费方式无效，固定运费须提供金额')


def clean_listing_receipt(data):
    _fields(data, ('id', 'revision', 'itemId', 'status', 'price', 'shipping', 'verifiedAt'))
    if data['status'] != 'online':
        raise ValidationError('必须回读确认商品在线才能登记上架')
    revision = data['revision']
    if type(revision) is not int or revision < 0:
        raise ValidationError('副本版本无效')
    return {'id': _identifier(data['id'], r'[0-9a-f]{32}', '副本编号'), 'revision': revision,
            'itemId': _identifier(data['itemId'], ITEM_ID, '商品编号'),
            'price': _amount(data['price'], '上架价'), 'shipping': _shipping(data['shipping']),
            'verifiedAt': _verified_at(data['verifiedAt'])}


def clean_paid_order(data):
    _fields(data, ('orderId', 'itemId', 'date', 'gross'), ('fees', 'postage'))
    order = {'orderId': _identifier(data['orderId'], ORDER_ID, '订单号'),
             'itemId': _identifier(data['itemId'], ITEM_ID, '商品编号'),
             'date': _trade_date(data['date'], '付款日期'), 'gross': _amount(data['gross'], '成交价')}
    for key, label in (('fees', '平台扣费'), ('postage', '寄出运费')):
        if key in data:
            order[key] = _amount(data[key], label)
    return order


def clean_settlement(data):
    _fields(data, ('orderId',), ('buyerReceived', 'settledDate'))
    buyer_received = data.get('buyerReceived', False)
    if type(buyer_received) is not bool or not (buyer_received or 'settledDate' in data):
        raise ValidationError('请提供至少一项已核实的收货或到账事实')
    return {'orderId': _identifier(data['orderId'], ORDER_ID, '订单号'),
            'buyerReceived': buyer_received,
            'settledDate': _trade_date(data['settledDate'], '到账日期') if 'settledDate' in data else None}
