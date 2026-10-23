"""查询页专辑列表的父级封面：优先 iTunes（数字版，CDN 快且稳定），查不到再退回 Cover Art Archive。
每张专辑只做一次 iTunes 关键词搜索（严格比对标题 + 艺人），结果（含查无）按专辑 id 缓存；
搜索接口最多等 BUDGET 秒，没赶上的先给 CAA 地址，查询在后台继续并写进缓存，下次直接命中。图片本身不经服务器。"""
import json
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, wait
from urllib.parse import urlencode

from covers import album_key, artist_matches, artwork_url
from domain import ValidationError

BUDGET = 1.2
HIT_TTL, MISS_TTL = 30 * 86400, 86400
_cache = {}   # 专辑 id → (写入时间, iTunes 封面地址或 None)
_guard = threading.Lock()
_pending = {}
_pool = ThreadPoolExecutor(max_workers=6)


def _itunes_cover(covers, title, artist, country):
    # 不走 covers.metadata：它为了配额把 iTunes 请求隔 3.1 秒串行，十张专辑根本赶不上预算；
    # 这里每张专辑只发 1~2 次请求，由 6 个线程并发，失败就退回 CAA、不写缓存
    try:
        raw = json.loads(covers.read('https://itunes.apple.com/search?' + urlencode(
            {'term': f'{title} {artist}', 'entity': 'album', 'limit': 8, 'country': country,
             'lang': 'ja_jp' if country == 'JP' else 'en_us'}), 1024 * 1024))
    except (ValueError, TypeError) as exc:
        raise ValidationError('封面服务返回的数据无法读取') from exc
    want = album_key(title)
    for item in (raw.get('results') if isinstance(raw, dict) else None) or []:
        url = str(item.get('artworkUrl100') or '')
        if not url or album_key(str(item.get('collectionName', ''))) != want: continue
        if artist and not artist_matches(artist, str(item.get('artistName', ''))): continue
        try: artwork_url(url)
        except ValidationError: continue
        return re.sub(r'/100x100bb\.', '/300x300bb.', url)
    return None


def _resolve(covers, gid, title, artist):
    url, failed = None, False
    for country in ('JP', 'US'):
        try: url = _itunes_cover(covers, title, artist, country)
        except ValidationError: failed = True; break   # 来源暂时不可用：不记入缓存，下次再试
        if url: break
    with _guard:
        _pending.pop(gid, None)
        if url or country == 'US' and not failed: _cache[gid] = (time.time(), url)
    return url


def _cached(gid):
    hit = _cache.get(gid)
    if not hit: return False, None
    if time.time() - hit[0] > (HIT_TTL if hit[1] else MISS_TTL): return False, None
    return True, hit[1]


def attach_covers(covers, groups, budget=BUDGET):
    """给每个 MusicBrainz 专辑加 coverSource；iTunes 命中时 cover 换成 iTunes 地址。"""
    if covers is None: return groups
    waits = []
    for g in groups:
        if g.get('source') != 'musicbrainz': continue
        done, url = _cached(g['id'])
        if not done:
            with _guard:
                fut = _pending.get(g['id']) or _pending.setdefault(
                    g['id'], _pool.submit(_resolve, covers, g['id'], g['title'], g['artist']))
            waits.append((g, fut)); continue
        _apply(g, url)
    if waits:
        wait([f for _, f in waits], timeout=budget)
        for g, fut in waits:
            _apply(g, fut.result() if fut.done() and not fut.exception() else None)
    for g in groups:
        g.setdefault('coverSource', 'caa' if g.get('cover') else '')
    return groups


def _apply(g, url):
    if url: g['cover'], g['coverSource'] = url, 'itunes'
    else: g['coverSource'] = 'caa'
