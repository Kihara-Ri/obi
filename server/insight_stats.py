"""采购评估的统计工具（D-049）：近期加权、加权中位数与分位、有效样本数、趋势、比例区间、介质归一。

只做数学与格式化，不读账本；server/insight_api.py 负责取样本。
"""
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
import math
import re

WINDOW_MONTHS = 36
TREND_DAYS = 180
DEFAULT_HALF_LIFE = 180
# 区间边界约每档 ×1.5；超出表尾后按同样比例继续（两位有效数字）
BAND_EDGES = [10, 15, 22, 33, 50, 75, 110, 170, 250, 380, 570, 850, 1300, 2000]
LP_RE = re.compile(r'vinyl|\blp\b|(?<![\d.])(7|10|12)\s*(″|"|”|inch|in\b|吋|寸)|黑胶', re.I)
OTHER_RE = re.compile(r'cassette|tape|磁带|dvd|blu-?ray|vhs|laserdisc|\bbox\b|minidisc|\bmd\b|file|digital', re.I)


def media_format(text):
    """CD / LP / other。没有介质资料的副本按 CD 计：收藏以 CD 为主，黑胶和磁带通常会登记介质。"""
    text = str(text or '')
    if LP_RE.search(text):
        return 'LP'
    if 'cd' in text.casefold():
        return 'CD'
    return 'other' if OTHER_RE.search(text) else 'CD'


def record_format(record):
    if record.get('vinyl'):   # 填过黑胶规格的副本一定是黑胶（D-055）
        return 'LP'
    info = record.get('releaseInfo') or {}
    parts = [info.get('format') or ''] + [str(m.get('format') or '') for m in info.get('media') or []
                                          if isinstance(m, dict)]
    return media_format(' '.join(parts))


def window_start(as_of):
    year, month = as_of.year - WINDOW_MONTHS // 12, as_of.month
    day = min(as_of.day, 28)
    return date(year, month, day)


def weight(day, as_of, half_life):
    """指数衰减权重；窗口外或日期无效返回 None。"""
    try:
        d = date.fromisoformat(str(day)[:10])
    except ValueError:
        return None
    if d < window_start(as_of) or d > as_of:
        return None
    return 0.5 ** ((as_of - d).days / half_life)


def quantile(samples, q):
    """samples: [(value, weight)]；加权分位（累计权重首次达到 q 的值，恰在边界时取两侧均值）。"""
    pairs = sorted((Decimal(v), w) for v, w in samples if w > 0)
    if not pairs:
        return None
    total, run = sum(w for _, w in pairs), 0.0
    for i, (v, w) in enumerate(pairs):
        run += w
        if math.isclose(run, total * q, rel_tol=1e-9) and i + 1 < len(pairs):
            return (v + pairs[i + 1][0]) / 2
        if run > total * q:
            return v
    return pairs[-1][0]


def n_eff(samples):
    ws = [w for _, w in samples]
    return round(sum(ws) ** 2 / sum(w * w for w in ws), 1) if ws else 0


def trend(dated, as_of):
    """dated: [(day, value, weight)]。近 180 天与更早各至少 2 条时返回近期中位数 ÷ 更早中位数。"""
    cut = as_of - timedelta(days=TREND_DAYS)
    recent = [(v, w) for d, v, w in dated if date.fromisoformat(d[:10]) > cut]
    older = [(v, w) for d, v, w in dated if date.fromisoformat(d[:10]) <= cut]
    if len(recent) < 2 or len(older) < 2:
        return None
    base = quantile(older, 0.5)
    return ratio(quantile(recent, 0.5) / base) if base and base > 0 else None


def money(value):
    return str(Decimal(value).quantize(Decimal('0.01'), ROUND_HALF_UP)) if value is not None else None


def ratio(value):
    return str(Decimal(value).quantize(Decimal('0.001'), ROUND_HALF_UP)) if value is not None else None


def edges():
    yield from BAND_EDGES
    edge = BAND_EDGES[-1]
    while True:
        edge = float(f'{edge * 1.5:.2g}')
        yield int(edge)


def band(value):
    """单条样本的比例区间；负数（亏损）按绝对值取档后取反。"""
    value = Decimal(value)
    size = abs(value)
    previous = 0
    for edge in edges():
        if size < edge:
            break
        previous = edge
    low, high = Decimal(previous), Decimal(edge)
    if value < 0:
        low, high = -high, -low
    return {'low': money(low), 'high': money(high)}


def summary(samples):
    """金额组：n≥2 给加权中位数字符串，n=1 给区间，n=0 为 None。"""
    if not samples:
        return None
    if len(samples) == 1:
        return band(samples[0][0])
    return money(quantile(samples, 0.5))


def upper(value):
    """估算时取保守值：区间取上限。"""
    return Decimal(value['high']) if isinstance(value, dict) else (Decimal(value) if value is not None else None)
