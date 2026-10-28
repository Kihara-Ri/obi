"""并发检索结果的合并：各来源已各自做过精确匹配，这里只按条码 / 唱片编号去重与排序，不按标题猜。

- 实体资料库（MusicBrainz、Discogs）在前，数字发行（Deezer、iTunes）在后。
- Discogs 与 MusicBrainz 编号相同且条码相同（都不为空）视为同一实体版，留 MusicBrainz，Discogs 记入 `alsoIn`。
  同一来源内部不合并：MusicBrainz 同码的多个版次（含私录借用条码）全部保留。
- 数字发行与已列出的实体版条码相同（左侧补零不计）：不另列卡片，记入每一条同码实体版的 `alsoIn`；
  只有同码实体版恰好一条且它没有自带封面时才借用这张数字封面（多条时无法确定是哪一版）。
  两条数字发行同码时留资料更全的一条。`alsoIn` 每个来源只记一条。
- 日本 JAN（45 / 49 开头）只影响顺序：日本区实体版在前，数字发行 iTunes 在 Deezer 前；不决定查不查哪个来源。"""
import re

PHYSICAL = ('musicbrainz', 'discogs')
DIGITAL = ('deezer', 'itunes')


def _code(value):
    return re.sub(r'\D', '', str(value or '')).lstrip('0')


def _catnos(value):
    return {re.sub(r'[^\w]', '', part).casefold() for part in str(value or '').split(' / ')} - {''}


def japanese(barcode):
    digits = re.sub(r'\D', '', str(barcode or ''))
    return len(digits) == 13 and digits[:2] in ('45', '49')


def _ref(candidate):
    return {'id': candidate['id'], 'source': candidate.get('source') or 'musicbrainz', 'url': candidate.get('url', '')}


def _attach(host, other, lend=True):
    refs = host.setdefault('alsoIn', [])
    if not any(r['source'] == (other.get('source') or 'musicbrainz') for r in refs): refs.append(_ref(other))
    if lend and not host.get('cover') and other.get('cover'):
        host['cover'], host['coverSmall'] = other['cover'], other.get('coverSmall') or other['cover']


def _richness(candidate):
    info = candidate.get('releaseInfo') or {}
    return sum(1 for value in (info.get('label'), info.get('releaseDate'), candidate.get('cover'), candidate.get('artist')) if value)


def _same_physical(a, b):
    ia, ib = a.get('releaseInfo') or {}, b.get('releaseInfo') or {}
    code = _code(ia.get('barcode'))
    return bool(code) and code == _code(ib.get('barcode')) and bool(_catnos(ia.get('catalogNumber')) & _catnos(ib.get('catalogNumber')))


def merge(found, barcode=''):
    """found：{来源名: 候选列表}（每个来源已精确过滤）。返回合并后的候选列表；不修改传入的候选。"""
    jp = japanese(barcode)
    kept = []
    for name in PHYSICAL:
        for candidate in found.get(name) or []:
            candidate = dict(candidate)
            twin = next((k for k in kept if k.get('source', 'musicbrainz') != candidate.get('source', 'musicbrainz')
                         and _same_physical(k, candidate)), None)
            if twin: _attach(twin, candidate)
            else: kept.append(candidate)
    if jp:   # 稳定排序：只把日本区提前，其余保持来源原有顺序
        kept.sort(key=lambda c: (c.get('releaseInfo') or {}).get('country') != 'JP')
    digital = []
    for name in (('itunes', 'deezer') if jp else DIGITAL):
        for candidate in found.get(name) or []:
            candidate = dict(candidate)
            code = _code((candidate.get('releaseInfo') or {}).get('barcode'))
            same = lambda k: bool(code) and _code((k.get('releaseInfo') or {}).get('barcode')) == code
            hosts = [k for k in kept if same(k)]
            for host in hosts: _attach(host, candidate, lend=len(hosts) == 1)
            if hosts: continue
            rival = next((k for k in digital if same(k)), None)
            if rival is None: digital.append(candidate); continue
            if _richness(candidate) > _richness(rival):
                digital[digital.index(rival)] = candidate
                candidate['alsoIn'] = rival.pop('alsoIn', [])
                rival, candidate = candidate, rival
            _attach(rival, candidate)
    return kept + digital
