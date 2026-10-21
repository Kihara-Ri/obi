"""查询页的文字模糊搜索：先按专辑（MusicBrainz release group）去重列出，再按需展开某张专辑的 CD 版本。
MusicBrainz 优先，没有结果或不可用时用 Discogs master 兜底；版本候选与条码 / 编号检索同形。"""
import re
from urllib.parse import urlencode

from domain import ValidationError, clean_release_info
from musicbrainz import lucene_quote
from server.discogs_catalog import COUNTRIES, _artist, _digits

GROUP = re.compile(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}')
MASTER = re.compile(r'discogs-m([1-9][0-9]{0,9})')
KINDS = {'Album': 'album', 'EP': 'ep', 'Single': 'single'}


def _terms(text):
    words = re.findall(r'[^\s]+', str(text or '').strip())[:8]
    if not words or sum(len(w) for w in words) < 2: raise ValidationError('请输入至少两个字的专辑名或艺人名')
    return words


def _artist_name(credit):
    return ''.join(a.get('name', '') + a.get('joinphrase', '') for a in credit or [] if isinstance(a, dict))


def _mb_groups(cat, words):
    query = ' AND '.join(f'(releasegroup:{lucene_quote(w)} OR artist:{lucene_quote(w)})' for w in words)
    with cat.catalog_lock:
        data = cat._mb_json('https://musicbrainz.org/ws/2/release-group/?' + urlencode(
            {'query': query, 'fmt': 'json', 'limit': 10}))
    out = []
    for g in data.get('release-groups', []):
        if not isinstance(g, dict) or not GROUP.fullmatch(str(g.get('id', ''))): continue
        out.append({'id': g['id'], 'title': str(g.get('title', '')), 'artist': _artist_name(g.get('artist-credit')),
                    'year': str(g.get('first-release-date') or '')[:4], 'kind': KINDS.get(g.get('primary-type'), 'other'),
                    'source': 'musicbrainz', 'cover': f"https://coverartarchive.org/release-group/{g['id']}/front-250"})
    return sorted(out, key=lambda g: g['kind'] != 'album')   # 稳定排序：正式专辑在前，其余保持相关度顺序


def _discogs_groups(dc, words):
    data = dc._get('database/search', {'type': 'master', 'q': ' '.join(words), 'per_page': 10})
    out = []
    for item in data.get('results', []):
        if not isinstance(item, dict) or type(item.get('id')) is not int: continue
        artist, _, title = str(item.get('title', '')).partition(' - ')
        out.append({'id': f"discogs-m{item['id']}", 'title': (title or artist).strip(), 'artist': _artist(artist) if title else '',
                    'year': str(item.get('year') or ''), 'kind': 'album', 'source': 'discogs', 'cover': ''})
    return out


def search_albums(cat, text):
    words = _terms(text); sources = {}; groups = []
    for name, fn, client in (('musicbrainz', _mb_groups, cat), ('discogs', _discogs_groups, cat.discogs)):
        if client is None or groups: continue
        try:
            groups = fn(client, words)
            sources[name] = 'found' if groups else 'none'
        except ValidationError as exc:
            sources[name] = str(exc)
    if not groups and all(v not in ('none', 'found') for v in sources.values()):
        raise ValidationError('发行资料库暂时不可用，请稍后重试（' + '；'.join(sources.values()) + '）')
    return groups, sources


def _rank(c):
    info = c['releaseInfo']
    return (info.get('country') != 'JP', not info.get('barcode'), info.get('releaseDate') or '9999')


def group_versions(cat, ident):
    """某张专辑下所有 CD 版本，日本版 / 有条码的排前面。"""
    if isinstance(ident, str) and MASTER.fullmatch(ident):
        if not cat.discogs: raise ValidationError('备用发行资料来源未启用')
        data = cat.discogs._get(f'masters/{MASTER.fullmatch(ident)[1]}/versions', {'format': 'CD', 'per_page': 40})
        out = []
        for v in data.get('versions', []):
            if not isinstance(v, dict) or type(v.get('id')) is not int: continue
            out.append({'id': f"discogs-{v['id']}", 'source': 'discogs', 'title': str(v.get('title', '')), 'artist': '',
                        'releaseInfo': clean_release_info({'catalogNumber': str(v.get('catno') or ''), 'barcode': '', 'label': str(v.get('label') or ''),
                                        'country': COUNTRIES.get(str(v.get('country', '')), str(v.get('country', ''))),
                                        'releaseDate': str(v.get('released') or ''), 'format': 'CD'}),
                        'identifierMatch': False, 'url': 'https://www.discogs.com/release/' + str(v['id'])})
        return sorted(out, key=_rank)
    if not isinstance(ident, str) or not GROUP.fullmatch(ident): raise ValidationError('专辑编号不正确')
    with cat.catalog_lock:
        data = cat._mb_json('https://musicbrainz.org/ws/2/release/?' + urlencode(
            {'release-group': ident, 'inc': 'labels+media', 'fmt': 'json', 'limit': 100}))
    found, seen = [], set()
    for c in (cat.candidate(r) for r in data.get('releases', [])):
        if not c: continue
        i = c['releaseInfo']   # 同编号 / 地区 / 日期 / 厂牌 / 条码的重复收录只留一个，免得列表里一排一模一样的行
        key = tuple(i.get(k, '') for k in ('catalogNumber', 'country', 'releaseDate', 'label', 'barcode', 'edition'))
        if key not in seen: seen.add(key); found.append(c)
    return sorted(found, key=_rank)
