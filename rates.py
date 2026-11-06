"""JPY→CNY quote authority: cache-only reads, explicit preparation, no ledger writes."""
import threading
from datetime import date, timedelta
from time import time
from rate_cache import QuoteCache
from rate_provider import SOURCE, SOURCES, RateUnavailable, clean_day, clean_values, http_fetch, windows

TTL = 300


class RateService:
    def __init__(self, cache_path=None, fetch=None, today=None, now=None):
        self.cache = QuoteCache(cache_path)
        self.cache_path, self.fetch = cache_path, fetch or http_fetch
        self.today = today or (lambda: date.today().isoformat())
        self.now = now or (lambda: time())
        self.lock, self.fetch_lock = threading.RLock(), threading.Lock()
        self.retry_at, self.error = 0, ''
        self.mem = self.cache.values  # Loaded daily values retained for historical cache compatibility.

    def _fresh(self, day, check):
        if not check: return False
        if check.get('provisional') and check.get('checkedOn') != self.today(): return False
        return not check.get('provisional') and check.get('status') in ('exact', 'previous') or check['checkedAt'] + TTL > self.now()

    def quote(self, day):
        with self.lock:
            q = {'requestedDate': day, 'quoteDate': None, 'rate': None, 'source': SOURCE,
                 'status': 'pending', 'checkedAt': None, 'provisional': False}
            if not clean_day(day): return {**q, 'status': 'invalid'}
            if day > self.today(): return {**q, 'status': 'future'}
            check = self.cache.checks.get(day)
            recent = (date.fromisoformat(self.today()) - date.fromisoformat(day)).days <= 2
            if day in self.mem and not recent and not (check or {}).get('provisional'):
                return {**q, 'quoteDate': day, 'rate': self.mem[day], 'status': 'exact',
                        'checkedAt': (check or {}).get('checkedAt')}
            if self._fresh(day, check):
                quote_day = check.get('quoteDate')
                if quote_day and quote_day in self.mem and 0 <= (date.fromisoformat(day) - date.fromisoformat(quote_day)).days <= 14:
                    return {**q, **check, 'requestedDate': day, 'rate': self.mem[quote_day]}
                return {**q, **check, 'requestedDate': day, 'rate': None}
            if self.retry_at > self.now():
                return {**q, 'status': 'unavailable', 'checkedAt': self.retry_at - TTL,
                        'provisional': recent, 'checkedOn': self.today()}
            return q

    def snapshot(self, days):
        # Money and displayed quote metadata must come from the same cache revision.
        with self.lock:
            return {day: self.quote(day) for day in days}

    def peek(self, day):
        return self.quote(day)['rate']

    def needed_dates(self, days):
        return sorted({d for d in days if clean_day(d) and self.quote(d)['status'] == 'pending'})

    def resolve(self, day):
        found = self.quote(day)
        if found['status'] == 'pending': self.warm([day])
        return self.quote(day)

    def get(self, day):
        return self.resolve(day)['rate']

    def warm(self, days, *, max_windows=None):
        # Only callers preparing quotes wait here. Ordinary quote/state reads never wait for network.
        with self.fetch_lock:
            pending = self.needed_dates(days)
            for index, (start, end, chunk) in enumerate(windows(pending)):
                if max_windows is not None and index >= max_windows: break
                with self.lock:
                    if self.retry_at > self.now(): break
                try:
                    found = clean_values(self.fetch(start, end), start, min(end, self.today()))
                    checked = self.now()
                    checks = {}
                    for day in chunk:
                        earlier = [d for d in found if d <= day]
                        quote_day = max(earlier) if earlier else None
                        if quote_day and (date.fromisoformat(day) - date.fromisoformat(quote_day)).days > 14:
                            quote_day = None
                        checks[day] = {'quoteDate': quote_day, 'checkedAt': checked,
                                       'status': ('exact' if quote_day == day else 'previous') if quote_day else 'unavailable',
                                       'provisional': (date.fromisoformat(self.today()) - date.fromisoformat(day)).days <= 2,
                                       'checkedOn': self.today()}
                    with self.lock:
                        self.cache.save(found, checks)
                        self.retry_at, self.error = 0, ''
                except RateUnavailable as exc:
                    with self.lock:
                        self.retry_at, self.error = self.now() + TTL, str(exc)[:100]
                    break

    def status(self, days=()):
        with self.lock:
            expiries = [c['checkedAt'] + TTL for d, c in self.cache.checks.items()
                        if (c.get('provisional') or c.get('status') == 'unavailable') and c['checkedAt'] + TTL > self.now()]
            if self.retry_at > self.now(): expiries.append(self.retry_at)
            return {'days': len(self.mem), 'latest': max(self.mem) if self.mem else None,
                    'neededDates': self.needed_dates(days), 'retryAt': min(expiries) if expiries else None,
                    'error': self.error}

    def cache_key(self):
        with self.lock:
            expired = tuple(sorted(d for d, c in self.cache.checks.items() if not self._fresh(d, c)))
            return self.cache.generation, self.today(), expired, self.retry_at > self.now()

    def accept_quotes(self, quotes):
        """Local Worker adapter only; no HTTP route accepts client-supplied financial rates."""
        with self.lock:
            values, checks = {}, {}
            for q in quotes:
                day, quote_day = q.get('requestedDate'), q.get('quoteDate')
                if not clean_day(day) or day > self.today() or q.get('source') != SOURCE: continue
                original_checked = q.get('checkedAt')
                checked = original_checked
                stable = day < self.today() and not q.get('provisional') and q.get('status') in ('exact', 'previous')
                if stable and checked is None: checked = 0
                if not isinstance(checked, (int, float)): continue
                if not stable and not 0 <= self.now() - checked <= TTL: continue
                if checked > self.now(): continue
                old = self.cache.checks.get(day, {})
                if (old.get('checkedAt') or 0) > checked: continue
                if q.get('status') in ('exact', 'previous') and clean_day(quote_day) and quote_day <= day:
                    if (date.fromisoformat(day) - date.fromisoformat(quote_day)).days > 14: continue
                    values.update(clean_values({quote_day: q.get('rate')}, quote_day, day))
                elif q.get('status') != 'unavailable': continue
                checks[day] = {k: q[k] for k in ('quoteDate', 'status', 'provisional')}
                checks[day]['checkedAt'] = original_checked
                checks[day]['checkedOn'] = q.get('checkedOn', self.today())
            self.cache.save(values, checks)
