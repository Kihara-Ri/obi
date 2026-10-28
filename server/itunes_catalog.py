"""iTunes / Apple Music 发行版检索：按 UPC（日本 CD 的 JAN 与之同码）精确匹配，接在 Deezer 之后补条码盲区。

公开接口、无需密钥；只做精确条码匹配，不按标题猜版本。候选与 `ReleaseCatalog.catalog` 同形，
id 为 `itunes-<collectionId>`。先查日本区，没有再查美国区。Apple Music 收录的是数字发行，
因此不宣称 CD 介质，也不填碟数；厂牌取自 ℗ 版权行，唱片编号不从封面文件名推测。"""
import json
import re
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

from domain import ValidationError, clean_release_info

API_HOST = 'itunes.apple.com'
COUNTRIES = ('jp', 'us')
USER_AGENT = 'Obi/2.4 (personal CD catalog; local instance)'
IDENT = re.compile(r'itunes-([1-9][0-9]{0,11})')
SUFFIX = re.compile(r'\s+-\s+(?:Single|EP)$')
COPYRIGHT = re.compile(r'^\s*(?:℗|©|\(P\)|\(C\))?\s*(?:\d{4}\s+)?')


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _digits(value): return re.sub(r'\D', '', str(value or ''))


def _art(collection, size):
    """artworkUrl100 只是 100px 缩略图；mzstatic 按路径里的尺寸出图，换成需要的尺寸。"""
    value = collection.get('artworkUrl100')
    if not isinstance(value, str) or not value.startswith('https://'): return ''
    return re.sub(r'/\d+x\d+bb\.(jpg|png)$', f'/{size}x{size}bb.\\1', value)


def _label(collection):
    return COPYRIGHT.sub('', str(collection.get('copyright') or '')).strip()


def _title(collection):
    return SUFFIX.sub('', str(collection.get('collectionName') or '').strip())


class ItunesCatalog:
    def __init__(self, opener=None, clock=time.monotonic, sleep=time.sleep, interval=0.5, timeout=10.0):
        self._lock = threading.Lock()
        self._opener = opener or build_opener(_NoRedirect())
        self._clock, self._sleep, self.interval, self.timeout = clock, sleep, interval, timeout
        self._last = float('-inf'); self._cooldown_until = float('-inf')
        self.cache = {}
        self.details_cache = {}

    def _get(self, params):
        url = f'https://{API_HOST}/lookup?' + urlencode(params)
        with self._lock:
            now = self._clock()
            if self._cooldown_until > now: raise ValidationError('iTunes 限流冷却中，请稍后重试')
            wait = self.interval - (now - self._last)
            if wait > 0: self._sleep(wait)
            self._last = self._clock()
        try:
            with self._opener.open(Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'}),
                                   timeout=self.timeout) as response:
                body = response.read(2 * 1024 * 1024 + 1)
            if len(body) > 2 * 1024 * 1024: raise ValidationError('iTunes 响应过大')
            data = json.loads(body)
        except HTTPError as exc:
            # Apple 限流时常回 403 而不是 429。
            if exc.code in (403, 429):
                with self._lock: self._cooldown_until = self._clock() + 60
                raise ValidationError('iTunes 限流，请约 1 分钟后重试') from None
            if exc.code == 404: return []
            raise ValidationError('iTunes 暂时不可用') from None
        except (URLError, TimeoutError, OSError):
            raise ValidationError('无法连接 iTunes 或请求超时') from None
        except (ValueError, UnicodeError):
            raise ValidationError('iTunes 没有返回有效数据') from None
        results = data.get('results') if isinstance(data, dict) else None
        if not isinstance(results, list): raise ValidationError('iTunes 没有返回有效数据')
        return [r for r in results if isinstance(r, dict)]

    def _candidate(self, collection, barcode):
        collection_id = collection.get('collectionId')
        if type(collection_id) is not int or collection_id <= 0: return None
        if collection.get('wrapperType') != 'collection': return None
        title = _title(collection)
        if not title: return None
        info = clean_release_info({
            # lookup?upc= 本身就是精确匹配，结果里不回带条码，按查询的码记。
            'barcode': barcode, 'label': _label(collection),
            'releaseDate': str(collection.get('releaseDate') or '')[:10],
            # 数字发行：不写 CD，也不填碟数，免得把数字版说成实体介质。
            'format': '', 'discCount': '', 'itunesId': str(collection_id)})
        return {'id': f'itunes-{collection_id}', 'source': 'itunes', 'title': title,
                'artist': str(collection.get('artistName') or ''), 'releaseInfo': info, 'identifierMatch': True,
                'url': f'https://music.apple.com/album/{collection_id}',
                'cover': _art(collection, 1200), 'coverSmall': _art(collection, 300)}

    def search(self, barcode='', catno=''):
        """按 UPC / JAN 精确检索；iTunes 没有唱片编号索引，编号查询返回空。"""
        upc = _digits(barcode)
        if not 8 <= len(upc) <= 14: return []
        key = ('u', upc)
        if key in self.cache: return self.cache[key]
        found = []
        for country in COUNTRIES:
            found = [c for c in (self._candidate(r, upc) for r in self._get({'upc': upc, 'country': country})) if c]
            if found: break
        if len(self.cache) >= 100: self.cache.clear()
        self.cache[key] = found
        return found

    def release_details(self, ident):
        match = IDENT.fullmatch(ident) if isinstance(ident, str) else None
        if not match: raise ValidationError('发行版本编号不正确')
        if ident in self.details_cache: return self.details_cache[ident]
        collection_id = match[1]
        rows = []
        for country in COUNTRIES:
            rows = self._get({'id': collection_id, 'entity': 'song', 'country': country, 'limit': 200})
            if rows: break
        collection = next((r for r in rows if r.get('wrapperType') == 'collection'), None)
        if not collection: raise ValidationError('iTunes 没有这一条目')
        discs, flat = {}, []
        for track in sorted((r for r in rows if r.get('wrapperType') == 'track'),
                            key=lambda t: (t.get('discNumber') or 1, t.get('trackNumber') or 0)):
            title = str(track.get('trackName') or '').strip()
            if not title: continue
            disc = track.get('discNumber') if type(track.get('discNumber')) is int else 1
            disc = disc if 1 <= disc <= 99 else 1
            position = track.get('trackNumber') if type(track.get('trackNumber')) is int else len(discs.get(disc, [])) + 1
            position = position if 1 <= position <= 999 else len(discs.get(disc, [])) + 1
            row = {'position': position, 'title': title[:500]}
            length = track.get('trackTimeMillis')
            if type(length) is int and 0 <= length <= 86400000: row['lengthMs'] = length
            discs.setdefault(disc, []).append(row)
            if len(flat) < 500: flat.append(f"{disc}-{position} {row['title']}"[:500])
        info = clean_release_info({
            # 详情接口不回带条码：沿用搜索时的码（缓存里有）；核对条码时以此为准。
            'barcode': self._barcode_of(ident), 'label': _label(collection),
            'releaseDate': str(collection.get('releaseDate') or '')[:10], 'format': '',
            'discCount': str(len(discs) or 1), 'tracklist': flat,
            'media': [{'position': n, 'format': '', 'title': '', 'tracks': rows} for n, rows in sorted(discs.items())],
            'itunesId': collection_id})
        if len(self.details_cache) >= 100: self.details_cache.clear()
        self.details_cache[ident] = info
        return info

    def _barcode_of(self, ident):
        for found in self.cache.values():
            for c in found:
                if c['id'] == ident: return c['releaseInfo'].get('barcode', '')
        return ''

    def has_barcode(self, ident, barcode):
        """条码核对：重新按条码精确检索，看这一条目是否在结果里（详情接口不回带条码）。"""
        return any(c['id'] == ident for c in self.search(barcode=barcode))
