"""Discogs 发行版检索：MusicBrainz 未收录某个条码 / 唱片编号时的备用来源（仅标准库，公开接口，无需密钥）。

候选与 `ReleaseCatalog.catalog` 同形，id 为 `discogs-<数字>`；同样只做精确标识匹配，不按标题猜版本。
公开接口每分钟约 25 次，客户端串行并间隔 2.5 秒，限流后进入冷却。"""
import json
import re
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

from domain import ValidationError, clean_release_info

API_HOST = 'api.discogs.com'
USER_AGENT = 'Diedu/2.4 (personal CD catalog; local instance)'
IDENT = re.compile(r'discogs-([1-9][0-9]{0,9})')
COUNTRIES = {'Japan': 'JP', 'USA': 'US', 'UK': 'GB', 'Germany': 'DE', 'France': 'FR', 'Canada': 'CA',
             'Australia': 'AU', 'Netherlands': 'NL', 'Italy': 'IT', 'Spain': 'ES', 'Korea': 'KR',
             'South Korea': 'KR', 'China': 'CN', 'Taiwan': 'TW', 'Hong Kong': 'HK', 'Europe': 'XE'}


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _digits(value): return re.sub(r'\D', '', str(value or ''))
def _norm(value): return re.sub(r'[^\w]', '', str(value or '')).casefold()


def _artist(name):
    """Discogs 用 “Name (2)” 区分同名艺人，显示时去掉序号。"""
    return re.sub(r'\s*\(\d+\)$', '', str(name or '').strip())


def _seconds(text):
    match = re.fullmatch(r'(\d{1,3}):(\d{2})', str(text or '').strip())
    return (int(match[1]) * 60 + int(match[2])) * 1000 if match else None


class DiscogsCatalog:
    def __init__(self, opener=None, clock=time.monotonic, sleep=time.sleep, interval=2.5, timeout=10.0):
        self._lock = threading.Lock()
        self._opener = opener or build_opener(_NoRedirect())
        self._clock, self._sleep, self.interval, self.timeout = clock, sleep, interval, timeout
        self._last = float('-inf'); self._cooldown_until = float('-inf')
        self.cache = {}

    def _get(self, path, params=None):
        url = f'https://{API_HOST}/' + path + ('?' + urlencode(params) if params else '')
        with self._lock:
            now = self._clock()
            if self._cooldown_until > now: raise ValidationError('Discogs 限流冷却中，请稍后重试')
            wait = self.interval - (now - self._last)
            if wait > 0: self._sleep(wait)
            self._last = self._clock()
        try:
            with self._opener.open(Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'}),
                                   timeout=self.timeout) as response:
                body = response.read(2 * 1024 * 1024 + 1)
            if len(body) > 2 * 1024 * 1024: raise ValidationError('Discogs 响应过大')
            data = json.loads(body)
        except HTTPError as exc:
            if exc.code == 429:
                with self._lock: self._cooldown_until = self._clock() + 30
                raise ValidationError('Discogs 限流，请约 30 秒后重试') from None
            raise ValidationError('Discogs 暂时不可用' if exc.code != 404 else 'Discogs 没有这一条目') from None
        except (URLError, TimeoutError, OSError):
            raise ValidationError('无法连接 Discogs 或请求超时') from None
        except (ValueError, UnicodeError):
            raise ValidationError('Discogs 没有返回有效数据') from None
        if not isinstance(data, dict): raise ValidationError('Discogs 没有返回有效数据')
        return data

    def search(self, barcode='', catno=''):
        """按条码或唱片编号精确检索 CD；返回与 MusicBrainz 同形的候选，不做标题猜测。"""
        if not (barcode or catno): return []
        key = ('b', barcode) if barcode else ('c', _norm(catno))
        if key in self.cache: return self.cache[key]
        params = {'type': 'release', 'per_page': 15}
        params['barcode' if barcode else 'catno'] = barcode or catno
        out = []
        for item in self._get('database/search', params).get('results', []):
            if not isinstance(item, dict) or type(item.get('id')) is not int or item.get('type') != 'release': continue
            if 'CD' not in [str(f) for f in item.get('format', []) if isinstance(f, str)]: continue
            codes = item.get('barcode') if isinstance(item.get('barcode'), list) else []
            matched = (bool(barcode) and any(_digits(c) == _digits(barcode) for c in codes)) if barcode \
                else _norm(item.get('catno')) == _norm(catno)
            if not matched: continue
            artist, _, title = str(item.get('title', '')).partition(' - ')
            labels = list(dict.fromkeys(str(x) for x in item.get('label', []) if isinstance(x, str)))
            info = clean_release_info({
                'catalogNumber': str(item.get('catno') or ''),
                'barcode': next((_digits(c) for c in codes if _digits(c) == _digits(barcode)), '') if barcode else
                           next((_digits(c) for c in codes if _digits(c)), ''),
                'label': labels[0] if labels else '', 'country': COUNTRIES.get(str(item.get('country', '')), str(item.get('country', ''))),
                'releaseDate': str(item.get('year') or ''), 'edition': ', '.join(
                    str(f) for f in item.get('format', []) if f in ('Limited Edition', 'Reissue', 'Remastered', 'Promo')),
                'format': 'CD', 'discCount': str(item.get('format_quantity') or ''),
                'discogsReleaseId': str(item['id'])})
            out.append({'id': f"discogs-{item['id']}", 'source': 'discogs', 'title': (title or artist).strip(),
                        'artist': _artist(artist) if title else '', 'releaseInfo': info, 'identifierMatch': True,
                        'url': 'https://www.discogs.com/release/' + str(item['id'])})
        if len(self.cache) >= 100: self.cache.clear()
        self.cache[key] = out
        return out

    def release_details(self, ident):
        match = IDENT.fullmatch(ident) if isinstance(ident, str) else None
        if not match: raise ValidationError('发行版本编号不正确')
        data = self._get('releases/' + match[1])
        if not any(isinstance(f, dict) and f.get('name') == 'CD' for f in data.get('formats', [])):
            raise ValidationError('这一发行版本没有 CD 介质，请选择正确版本')
        labels = [l for l in data.get('labels', []) if isinstance(l, dict)]
        codes = [_digits(i.get('value')) for i in data.get('identifiers', [])
                 if isinstance(i, dict) and i.get('type') == 'Barcode' and _digits(i.get('value'))]
        discs, tracks = {}, []
        for track in data.get('tracklist', []):
            if not isinstance(track, dict) or track.get('type_', 'track') != 'track' or not str(track.get('title', '')).strip(): continue
            pos = re.match(r'(?:CD)?(\d+)[-.](\d+)$', str(track.get('position', '')).strip(), re.I)
            disc, number = (int(pos[1]), int(pos[2])) if pos else (1, len(discs.get(1, [])) + 1)
            row = {'position': number, 'title': str(track['title'])[:500]}
            if (ms := _seconds(track.get('duration'))) is not None: row['lengthMs'] = ms
            discs.setdefault(disc, []).append(row)
            if len(tracks) < 500: tracks.append(f"{disc}-{number} {row['title']}"[:500])
        quantity = next((int(f['qty']) for f in data.get('formats', []) if isinstance(f, dict) and str(f.get('qty', '')).isdigit()), 1)
        descriptions = [d for f in data.get('formats', []) if isinstance(f, dict) for d in f.get('descriptions', []) if isinstance(d, str)]
        return clean_release_info({
            'catalogNumber': ' / '.join(dict.fromkeys(str(l['catno']) for l in labels if l.get('catno') and l['catno'] != 'none')),
            'barcode': codes[0] if codes else '', 'label': ' / '.join(dict.fromkeys(str(l['name']) for l in labels if l.get('name'))),
            'country': COUNTRIES.get(str(data.get('country', '')), str(data.get('country', ''))),
            'releaseDate': str(data.get('released') or data.get('year') or ''),
            'edition': ', '.join(d for d in descriptions if d in ('Limited Edition', 'Reissue', 'Remastered', 'Promo')),
            'format': 'CD', 'discCount': str(max(quantity, len(discs) or 1)), 'tracklist': tracks,
            'media': [{'position': n, 'format': 'CD', 'title': '', 'tracks': rows} for n, rows in sorted(discs.items())],
            'discogsReleaseId': match[1]})
