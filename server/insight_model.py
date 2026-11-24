"""采购评估的计算（D-049）：成本模型、历史统计、候选匹配与落地成本估算。

Model 只读 insight_data.Ledger，不访问数据库和网络；金额一律人民币字符串，比例三位小数。
"""
from decimal import Decimal

from storage import Store
from .insight_data import artist_key, days_between
from .insight_stats import (media_format, money, n_eff, quantile, ratio, summary, trend, upper, weight,
                            window_start)

HELD = ('domestic', 'overseas')
FORMATS = ('CD', 'LP', 'other')


def stat(samples):
    return {'median': summary(samples), 'n': len(samples), 'nEff': n_eff(samples)} if samples else None


def ratio_median(samples):
    return ratio(quantile(samples, 0.5)) if len(samples) >= 2 else None


def days_median(samples):
    return int(quantile(samples, 0.5)) if len(samples) >= 2 else None


class Model:
    def __init__(self, ledger, as_of, half_life, current_rate=None):
        self.ledger, self.as_of, self.half_life = ledger, as_of, half_life
        self.current_rate = current_rate
        self.cost_model = self._cost_model()

    def w(self, day):
        return weight(day, self.as_of, self.half_life) if day else None

    def weighted(self, pairs):
        """[(value, day)] → [(value, weight)]，去掉窗口外与缺值的样本。"""
        return [(v, w) for v, d in pairs if v is not None and (w := self.w(d))]

    def by_format(self, items, value, day):
        return {f: s for f in FORMATS
                if (s := stat(self.weighted((value(x), day(x)) for x in items if x.format == f)))}

    def _cost_model(self):
        copies, sales = self.ledger.copies, self.ledger.sales
        jpy = [c for c in copies if c.currency == 'JPY']
        paid = self.weighted((c.rate, c.date) for c in jpy)
        sold = [s for s in sales if s.gross > 0]
        return {
            'jpyPer100': {'current': ratio(self.current_rate[0]) if self.current_rate else None,
                          'currentDate': self.current_rate[1] if self.current_rate else None,
                          'paidMedian': ratio_median(paid)},
            'overseasShippingPerCopy': self.by_format([c for c in copies if c.ship_fee is not None],
                                                      lambda c: c.ship_fee, lambda c: c.ship_date),
            'batchFeesPerCopy': self.by_format(jpy, lambda c: c.batch_fee, lambda c: c.date),
            'domesticPostage': stat(self.weighted((s.postage, s.date) for s in sold)),
            'platformFeeRate': (lambda xs: {'median': ratio_median(xs), 'n': len(xs)} if xs else None)(
                self.weighted((s.fees / s.gross, s.date) for s in sold)),
        }

    def rate(self):
        """估算用的日元汇率：有效缓存优先，否则用你实际付出的加权中位数。"""
        if self.current_rate:
            return Decimal(self.current_rate[0]), False
        paid = self.cost_model['jpyPer100']['paidMedian']
        return (Decimal(paid), True) if paid else (None, True)

    # ── 历史统计 ─────────────────────────────────────────────
    def history(self, copies):
        ids = {c.id for c in copies}
        buys = self.weighted((c.cost, c.date) for c in copies)
        sold = [s for s in self.ledger.sales if s.record.id in ids and self.w(s.date)]
        net = [(s.net, self.w(s.date)) for s in sold]
        profit = [(s.profit, self.w(s.date)) for s in sold if s.profit is not None]
        margin = [(s.profit / s.net, self.w(s.date)) for s in sold if s.profit is not None and s.net > 0]
        days = [(d, self.w(s.date)) for s in sold if (d := days_between(s.record.date, s.date)) is not None]
        unsold = [c for c in copies if c.id in self.ledger.listed_since]
        listed_days = [(self.as_of - self.ledger.listed_since[c.id]).days for c in unsold]
        return {
            'bought': len(buys), 'costMedian': summary(buys),
            'costRange': [money(quantile(buys, .1)), money(quantile(buys, .9))] if len(buys) >= 3 else None,
            'sold': len(sold), 'nEff': n_eff(net), 'netMedian': summary(net), 'profitMedian': summary(profit),
            'marginMedian': ratio_median(margin),
            'trend': trend([(s.date, s.net, self.w(s.date)) for s in sold], self.as_of),
            'daysToSellMedian': days_median(days),
            'listedUnsold': len(unsold), 'listedUnsoldDaysMax': max(listed_days) if listed_days else None,
        }

    # ── 候选 ────────────────────────────────────────────────
    def match(self, cand):
        pool = self.ledger.copies
        if cand.get('catalogNumber') and (hit := [c for c in pool if cand['catalogNumber'] in c.catnos]):
            return 'release', 'catalogNumber', hit
        if cand.get('barcode') and (hit := [c for c in pool if c.barcode == cand['barcode']]):
            return 'release', 'barcode', hit
        if cand.get('artist') and cand.get('title'):
            key = Store.album_identity(cand)
            if hit := [c for c in pool if c.album == key]:
                return 'album', 'name', hit
        if cand.get('artist') and (hit := [c for c in pool if c.artist == artist_key(cand['artist'])]):
            return 'artist', 'artist', hit
        return 'none', None, []

    def evaluate(self, cand):
        level, by, hit = self.match(cand)
        fmt = media_format(cand['format']) if cand.get('format') else None
        notes, owned = [], None
        if level in ('release', 'album'):
            owned = {'held': sum(c.status in HELD for c in hit), 'inTransit': sum(c.status == 'transit' for c in hit)}
            if owned['held']:
                notes.append(f"已有 {owned['held']} 张在库")
            if owned['inTransit']:
                notes.append(f"有 {owned['inTransit']} 张在途")
        chosen, history = hit, None
        if level == 'release' or (level != 'none' and fmt):
            chosen = hit if level == 'release' else [c for c in hit if c.format == fmt]
            history = self.history(chosen)
        result = {'ref': cand.get('ref'), 'match': {'by': by, 'level': level}, 'owned': owned, 'history': history}
        if level in ('album', 'artist') and not fmt:
            result['byFormat'] = {f: self.history(cs) for f in FORMATS if (cs := [c for c in hit if c.format == f])}
        if history and history['listedUnsold']:
            notes.append(f"另有 {history['listedUnsold']} 张已上架 {history['listedUnsoldDaysMax']} 天未售出")
        result['estimate'] = self.estimate(cand, fmt, level, history, notes) if cand.get('price') else None
        result['notes'] = notes
        return result

    def estimate(self, cand, fmt, level, history, notes):
        price, ship, currency = Decimal(cand['price']), Decimal(cand.get('shippingToWarehouse') or 0), cand['currency']
        parts = {'rate': None}
        if currency == 'JPY':
            rate, fallback = self.rate()
            if rate is None:
                notes.append('没有可用的日元汇率，无法估算落地成本')
                return None
            if fallback:
                notes.append('汇率缓存不可用，按你实际付出的汇率中位数折算')
            parts.update(item=price * rate / 100, shippingToWarehouse=ship * rate / 100, rate=ratio(rate))
            cost_fmt = fmt or 'CD'
            for key, model in (('overseasShipping', 'overseasShippingPerCopy'), ('batchFees', 'batchFeesPerCopy')):
                s = self.cost_model[model].get(cost_fmt)
                parts[key] = upper(s['median']) if s else Decimal(0)
                if not s:
                    notes.append(f'没有 {cost_fmt} 的{"国际运费" if key == "overseasShipping" else "整批费用"}样本，未计入')
                elif s['n'] == 1:
                    notes.append(f'{cost_fmt} 的{"国际运费" if key == "overseasShipping" else "整批费用"}只有 1 条样本，按区间上限计')
        else:
            parts.update(item=price, shippingToWarehouse=ship, overseasShipping=Decimal(0), batchFees=Decimal(0))
        landed = sum(v for k, v in parts.items() if k != 'rate')
        net = history['netMedian'] if history else None
        profit = margin = None
        if isinstance(net, dict):
            profit = {'low': money(Decimal(net['low']) - landed), 'high': money(Decimal(net['high']) - landed)}
            notes.append('同级只有 1 条成交，净收入与利润为区间')
        elif net is not None:
            profit = money(Decimal(net) - landed)
            margin = ratio(Decimal(profit) / Decimal(net)) if Decimal(net) > 0 else None
        if level in ('album', 'artist') and not fmt:
            notes.append('未给介质，无法按同介质估算净收入')
        return {'landedCost': money(landed),
                'parts': {k: (v if k == 'rate' else money(v)) for k, v in parts.items()},
                'expectedNet': net, 'expectedProfit': profit, 'expectedMargin': margin,
                'basis': level if history else None, 'n': history['sold'] if history else 0,
                'nEff': history['nEff'] if history else 0}

    def weighting(self):
        return {'halfLifeDays': self.half_life, 'from': window_start(self.as_of).isoformat()}

