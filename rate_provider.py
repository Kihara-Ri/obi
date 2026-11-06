"""Bounded Frankfurter v1/ECB requests; validates currency, date and finite rates."""
import json
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode
from urllib.request import Request, urlopen

SOURCE = 'ECB / Frankfurter'
SOURCES = ('https://api.frankfurter.dev/v1',)


class RateUnavailable(Exception):
    pass


def clean_day(value):
    if not isinstance(value, str): return None
    try:
        parsed = date.fromisoformat(value)
        return value if parsed.isoformat() == value else None
    except ValueError: return None


def clean_values(found, start, end):
    if not isinstance(found, dict): raise RateUnavailable('invalid response')
    result = {}
    for day, value in found.items():
        if not clean_day(day) or not start <= day <= end: continue
        try: amount = Decimal(str(value))
        except (InvalidOperation, ValueError): raise RateUnavailable('invalid quote') from None
        if not amount.is_finite() or not 0 < amount < 100000:
            raise RateUnavailable('invalid quote')
        result[day] = str(amount)
    return result


def http_fetch(start, end):
    query = urlencode({'base': 'JPY', 'symbols': 'CNY'})
    try:
        req = Request(f'{SOURCES[0]}/{start}..{end}?{query}',
                      headers={'User-Agent': 'Obi/RateService', 'Accept': 'application/json'})
        with urlopen(req, timeout=8) as response:
            raw = response.read((1 << 20) + 1)
        if len(raw) > 1 << 20: raise ValueError('oversized response')
        payload = json.loads(raw)
        if payload.get('base') != 'JPY' or payload.get('amount', 1) != 1:
            raise ValueError('unexpected base currency')
        return clean_values({d: Decimal(str(v['CNY'])) * 100 for d, v in payload['rates'].items()}, start, end)
    except Exception as exc:
        raise RateUnavailable(type(exc).__name__) from None


def windows(days):
    remaining = sorted(set(days))
    while remaining:
        first = date.fromisoformat(remaining[0])
        start = max(date.min, first - timedelta(days=min(14, (first - date.min).days)))
        end = min(date.max, start + timedelta(days=min(59, (date.max - start).days)))
        chunk = [d for d in remaining if d <= end.isoformat()]
        yield start.isoformat(), chunk[-1], chunk
        remaining = remaining[len(chunk):]
