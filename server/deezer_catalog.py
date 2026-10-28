"""Deezer 发行版检索：按 UPC（日本 CD 的 JAN 与之同码）精确匹配，补 MusicBrainz / Discogs 的条码盲区。

公开接口、无需密钥；只做精确条码匹配，不按标题猜版本。候选与 `ReleaseCatalog.catalog` 同形，
id 为 `deezer-<数字>`。Deezer 收录的是数字发行，因此不宣称 CD 介质，也不填碟数；
实体限定盘与数字版条码不同的，仍要靠 Discogs 编号或手动录入。"""
import json
import re
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

from domain import ValidationError, clean_release_info

API_HOST = 'api.deezer.com'
USER_AGENT = 'Obi/2.4 (personal CD catalog; local instance)'
IDENT = re.compile(r'deezer-([1-9][0-9]{0,9})')


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _digits(value): return re.sub(r'\D', '', str(value or ''))


def _same_code(left, right):
    """UPC-A（12 位）与 EAN-13（13 位）只在左侧补零上不同，按去掉前导零后的数字串比较。"""
    a, b = _digits(left).lstrip('0'), _digits(right).lstrip('0')
    return bool(a) and bool(b) and a == b and min(len(_digits(left)), len(_digits(right))) >= 8


def _cover(album, key, fallback=''):
    value = album.get(key)
    return value if isinstance(value, str) and value.startswith('https://') else fallback


class DeezerCatalog:
    def __init__(self, opener=None, clock=time.monotonic, sleep=time.sleep, interval=0.3, timeout=10.0):
        self._lock = threading.Lock()
        self._opener = opener or build_opener(_NoRedirect())
        self._clock, self._sleep, self.interval, self.timeout = clock, sleep, interval, timeout
        self._last = float('-inf'); self._cooldown_until = float('-inf')
        self.cache = {}
        self.details_cache = {}

    def _get(self, path, params=None):
        url = f'https://{API_HOST}/' + path + ('?' + urlencode(params) if params else '')
        with self._lock:
            now = self._clock()
            if self._cooldown_until > now: raise ValidationError('Deezer 限流冷却中，请稍后重试')
            wait = self.interval - (now - self._last)
            if wait > 0: self._sleep(wait)
            self._last = self._clock()
        try:
            with self._opener.open(Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'}),
                                   timeout=self.timeout) as response:
                body = response.read(2 * 1024 * 1024 + 1)
            if len(body) > 2 * 1024 * 1024: raise ValidationError('Deezer 响应过大')
            data = json.loads(body)
        except HTTPError as exc:
            if exc.code == 429:
                with self._lock: self._cooldown_until = self._clock() + 30
                raise ValidationError('Deezer 限流，请约 30 秒后重试') from None
            if exc.code == 404: return {}
            raise ValidationError('Deezer 暂时不可用' if exc.code != 403 else 'Deezer 拒绝访问') from None
        except (URLError, TimeoutError, OSError):
            raise ValidationError('无法连接 Deezer 或请求超时') from None
        except (ValueError, UnicodeError):
            raise ValidationError('Deezer 没有返回有效数据') from None
        if not isinstance(data, dict): raise ValidationError('Deezer 没有返回有效数据')
        # Deezer 用 200 + error 对象表示「没有这一条」，这与网络故障不同：按空结果处理。
        if data.get('error'): return {}
        return data

    def _candidate(self, album, barcode):
        album_id = album.get('id')
        if type(album_id) is not int or album_id <= 0: return None
        upc = _digits(album.get('upc'))
        if not _same_code(upc, barcode): return None
        artist = album.get('artist') if isinstance(album.get('artist'), dict) else {}
        title = str(album.get('title') or '').strip()
        if not title: return None
        info = clean_release_info({
            'barcode': upc, 'label': str(album.get('label') or ''),
            'releaseDate': str(album.get('release_date') or ''),
            # 数字发行：不写 CD，也不填碟数，免得把数字版说成实体介质。
            'format': '', 'discCount': '', 'deezerId': str(album_id)})
        return {'id': f'deezer-{album_id}', 'source': 'deezer', 'title': title,
                'artist': str(artist.get('name') or ''), 'releaseInfo': info, 'identifierMatch': True,
                'url': f'https://www.deezer.com/album/{album_id}',
                'cover': _cover(album, 'cover_xl', _cover(album, 'cover_big')),
                'coverSmall': _cover(album, 'cover_medium', _cover(album, 'cover_big'))}

    def search(self, barcode='', catno=''):
        """按 UPC / JAN 精确检索；Deezer 没有唱片编号索引，编号查询返回空。"""
        upc = _digits(barcode)
        if not upc: return []
        key = ('u', upc)
        if key in self.cache: return self.cache[key]
        album = self._get('album/upc:' + upc)
        candidate = self._candidate(album, upc) if album else None
        found = [candidate] if candidate else []
        if len(self.cache) >= 100: self.cache.clear()
        self.cache[key] = found
        return found

    def release_details(self, ident):
        match = IDENT.fullmatch(ident) if isinstance(ident, str) else None
        if not match: raise ValidationError('发行版本编号不正确')
        if ident in self.details_cache: return self.details_cache[ident]
        album_id = match[1]
        album = self._get('album/' + album_id)
        if not album: raise ValidationError('Deezer 没有这一条目')
        tracks = (album.get('tracks') or {}).get('data') or []
        # 专辑详情只带前 25 轨，完整曲目要单独取一次。
        if int(album.get('nb_tracks') or 0) > len(tracks):
            tracks = (self._get(f'album/{album_id}/tracks', {'limit': 100}).get('data')) or tracks
        discs, flat = {}, []
        for track in tracks:
            if not isinstance(track, dict): continue
            title = str(track.get('title') or '').strip()
            if not title: continue
            disc = track.get('disk_number') if type(track.get('disk_number')) is int else 1
            disc = disc if 1 <= disc <= 99 else 1
            position = track.get('track_position') if type(track.get('track_position')) is int else len(discs.get(disc, [])) + 1
            position = position if 1 <= position <= 999 else len(discs.get(disc, [])) + 1
            row = {'position': position, 'title': title[:500]}
            length = track.get('duration')
            if isinstance(length, (int, float)) and 0 <= length <= 86400: row['lengthMs'] = int(round(length * 1000))
            discs.setdefault(disc, []).append(row)
            if len(flat) < 500: flat.append(f"{disc}-{position} {row['title']}"[:500])
        info = clean_release_info({
            'barcode': _digits(album.get('upc')), 'label': str(album.get('label') or ''),
            'releaseDate': str(album.get('release_date') or ''), 'format': '',
            'discCount': str(len(discs) or 1), 'tracklist': flat,
            'media': [{'position': n, 'format': '', 'title': '', 'tracks': rows} for n, rows in sorted(discs.items())],
            'deezerId': album_id})
        if len(self.details_cache) >= 100: self.details_cache.clear()
        self.details_cache[ident] = info
        return info
