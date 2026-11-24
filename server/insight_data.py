"""采购评估的账本样本（D-049）：把 Store.state() 的成本、净收入、分摊运费整理成可加权的样本。

口径与账本一致：成本取 state() 派生的 cost，净收入与利润取销售明细的 net / profit；
回收站副本不计；销售只计已成交（售出中、已完成），取消、退货、退款不计。
"""
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
import json
from contextlib import closing
from typing import Optional

from .release_merge import _catnos, _code
from .insight_stats import record_format
from storage import Store

SOLD = ('shipping', 'complete')
LIST_ACTIONS = ('list', '保存并标记上架', '登记闲鱼上架回执')


def dec(value):
    return Decimal(value) if value not in (None, '') else None


@dataclass
class Copy:
    id: str
    artist: str          # 归一后的艺人键，用于匹配
    artist_name: str     # 原样的艺人名，用于排行
    album: str
    format: str
    status: str
    date: str
    cost: Optional[Decimal]
    currency: str
    rate: Optional[Decimal]
    label: str
    catnos: frozenset
    barcode: str
    listed: bool
    ship_fee: Optional[Decimal] = None
    ship_date: str = ''
    batch_fee: Decimal = Decimal(0)


@dataclass
class Sale:
    record: Copy
    date: str
    net: Decimal
    profit: Optional[Decimal]
    gross: Decimal
    fees: Decimal
    postage: Decimal


@dataclass
class Ledger:
    copies: list
    sales: list
    listed_since: dict = field(default_factory=dict)


def artist_key(name):
    return Store.album_identity({'artist': name, 'title': ''}).split('\u001f')[0]


def listed_since(store, ids):
    """副本最近一次标记上架的日期（与列表的上架排序同口径：更新已有标记不算重新上架）。"""
    found = {}
    if not ids:
        return found
    with closing(store.connect()) as db:
        rows = db.execute("SELECT at, action, data FROM audit WHERE action IN (?, ?, ?) AND json_valid(data) "
                          "ORDER BY id DESC", LIST_ACTIONS)
        for at, action, raw in rows:
            event = json.loads(raw)
            rid = event.get('id') if isinstance(event, dict) else None
            if rid not in ids or rid in found:
                continue
            before = event.get('before')
            if action == 'list' and isinstance(before, dict) and before.get('listed'):
                continue
            stamp = event.get('verifiedAt') if action == '登记闲鱼上架回执' else at
            try:
                found[rid] = datetime.fromisoformat(stamp).date()
            except (TypeError, ValueError):
                continue
    return found


def load(store):
    state = store.state()
    copies = {}
    for r in state['records']:
        if r['status'] == 'trash':
            continue
        info = r.get('releaseInfo') or {}
        copies[r['id']] = Copy(
            id=r['id'], artist=artist_key(r.get('artist')), artist_name=' '.join(str(r.get('artist') or '').split()), album=Store.album_identity(r),
            format=record_format(r), status=r['status'], date=r.get('date') or '', cost=dec(r.get('cost')),
            currency=r.get('currency') or '', rate=dec(r.get('rate')), label=str(info.get('label') or '').strip(),
            catnos=frozenset(_catnos(info.get('catalogNumber'))), barcode=_code(info.get('barcode')) or '',
            listed=bool(r.get('listed')), batch_fee=dec(r.get('fees')) or Decimal(0))
    for s in state['shipments']:
        for item in s['items']:
            c = copies.get(item['recordId'])
            if c and item.get('fee') not in (None, ''):
                c.ship_fee, c.ship_date = Decimal(item['fee']), s['date']
                c.batch_fee = max(Decimal(0), c.batch_fee - c.ship_fee)   # 账本把国际运费并入了 fees
    sales = []
    for s in state['sales']:
        if s['status'] not in SOLD:
            continue
        for item in s['items']:
            c = copies.get(item['recordId'])
            if c:
                sales.append(Sale(record=c, date=s['date'], net=Decimal(item['net']), profit=dec(item.get('profit')),
                                  gross=Decimal(item['gross']), fees=Decimal(item['fees']),
                                  postage=Decimal(item.get('postage') or 0)))
    listed = {c.id for c in copies.values() if c.listed and c.status in ('domestic', 'overseas')}
    return Ledger(copies=list(copies.values()), sales=sales, listed_since=listed_since(store, listed))


def days_between(start, end):
    try:
        return (date.fromisoformat(end[:10]) - date.fromisoformat(start[:10])).days
    except (TypeError, ValueError):
        return None
