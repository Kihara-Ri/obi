"""国立国会図書館（NDL Search）发行版检索：按唱片编号（発売番号，dcndl:RIS502）精确匹配日本实体 CD。

日本商业录音资料依法缴存，特摄 / 动画角色盘等 MusicBrainz、Discogs 没收录的也常在。公开接口、无需密钥。
两步：OpenSearch `any=<编号>` 找候选书目（SRU 的 anywhere 检索不到编号），只留编号完全一致的录音资料；
再用 SRU `itemno=` 取完整 dcndl 记录（介质「録音ディスク N枚 : CD」、收录曲、レーベル名）。
候选 id 为 `ndl-<NDLBibID>`。NDL 不登记条码，因此不参与条码检索，也不能核对条码；介质不是 CD 的不列出。
不返回 CORS 头，本机模式不接。"""
import re
import threading
import time
import xml.etree.ElementTree as ET
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

from domain import ValidationError, clean_release_info

API_HOST = 'ndlsearch.ndl.go.jp'
USER_AGENT = 'Obi/2.4 (personal CD catalog; local instance)'
IDENT = re.compile(r'ndl-([0-9]{9,12})')
REPOSITORY = 'R100000002-I'   # NDL 自身书目的记录前缀
NS = {'dc': 'http://purl.org/dc/elements/1.1/', 'dcterms': 'http://purl.org/dc/terms/',
      'dcndl': 'http://ndl.go.jp/dcndl/terms/', 'foaf': 'http://xmlns.com/foaf/0.1/',
      'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      'xsi': 'http://www.w3.org/2001/XMLSchema-instance', 'srw': 'http://www.loc.gov/zing/srw/'}
XSI_TYPE = '{%s}type' % NS['xsi']
RDF_TYPE = '{%s}datatype' % NS['rdf']


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _norm(value): return re.sub(r'[^\w]', '', str(value or '')).casefold()


def _text(node): return (node.text or '').strip() if node is not None else ''


def _date(value):
    """NDL 写「2009.4」或「2009.4.22」→ 2009-04 / 2009-04-22；认不出就留空，不猜。"""
    m = re.fullmatch(r'(\d{4})(?:\.(\d{1,2})(?:\.(\d{1,2}))?)?', str(value or '').strip())
    if not m: return ''
    return '-'.join([m[1]] + [p.zfill(2) for p in (m[2], m[3]) if p])


def tracks(parts):
    """收录曲：通常是一段「(1)A(2)B(3)C」，也可能每曲一段。编号从 (1) 重新开始视为下一张碟。
    没有 (n) 编号的整段不拆，按一首记（不臆造分曲）。"""
    discs, disc, last = {}, 1, 0
    for part in parts:
        pieces = re.split(r'\((\d{1,3})\)', part)
        numbered = list(zip(pieces[1::2], pieces[2::2]))
        if not numbered:
            numbered = [(str(last + 1), part)]
        for number, title in numbered:
            title = title.strip(' 　/;,')
            if not title: continue
            number = int(number)
            if number <= last and number == 1: disc += 1
            last = number
            discs.setdefault(disc, []).append({'position': number, 'title': title[:500]})
    return discs


class NdlCatalog:
    def __init__(self, opener=None, clock=time.monotonic, sleep=time.sleep, interval=1.0, timeout=8.0):
        self._lock = threading.Lock()
        self._opener = opener or build_opener(_NoRedirect())
        self._clock, self._sleep, self.interval, self.timeout = clock, sleep, interval, timeout
        self._last = float('-inf'); self._cooldown_until = float('-inf')
        self.cache = {}
        self.details_cache = {}

    def _get(self, path, params):
        url = f'https://{API_HOST}/api/{path}?' + urlencode(params)
        with self._lock:
            now = self._clock()
            if self._cooldown_until > now: raise ValidationError('国会图书馆（NDL）限流冷却中，请稍后重试')
            wait = self.interval - (now - self._last)
            if wait > 0: self._sleep(wait)
            self._last = self._clock()
        try:
            with self._opener.open(Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/xml'}),
                                   timeout=self.timeout) as response:
                body = response.read(4 * 1024 * 1024 + 1)
            if len(body) > 4 * 1024 * 1024: raise ValidationError('国会图书馆（NDL）响应过大')
            return ET.fromstring(body)
        except HTTPError as exc:
            if exc.code in (429, 503):
                with self._lock: self._cooldown_until = self._clock() + 60
                raise ValidationError('国会图书馆（NDL）限流，请约 1 分钟后重试') from None
            raise ValidationError('国会图书馆（NDL）暂时不可用') from None
        except (URLError, TimeoutError, OSError):
            raise ValidationError('无法连接国会图书馆（NDL）或请求超时') from None
        except ET.ParseError:
            raise ValidationError('国会图书馆（NDL）没有返回有效数据') from None

    def _bib_ids(self, catno):
        """OpenSearch：编号完全一致（忽略连字符 / 空格 / 大小写）的录音资料书目 ID。"""
        root = self._get('opensearch', {'any': catno, 'cnt': 20})
        found = []
        for item in root.iter('item'):
            if '録音資料' not in [_text(c) for c in item.findall('category')]: continue
            ids = {el.get(XSI_TYPE, ''): _text(el) for el in item.findall('dc:identifier', NS)}
            bib = ids.get('dcndl:NDLBibID', '')
            if re.fullmatch(r'[0-9]{9,12}', bib) and _norm(ids.get('dcndl:RIS502')) == _norm(catno) and bib not in found:
                found.append(bib)
        return found[:5]

    def _record(self, bib):
        """SRU：按书目 ID 取完整 dcndl 记录，返回 BibResource 节点（没有则 None）。"""
        root = self._get('sru', {'operation': 'searchRetrieve', 'version': '1.2', 'recordSchema': 'dcndl',
                                 'recordPacking': 'xml', 'maximumRecords': 1, 'query': f'itemno="{REPOSITORY}{bib}"'})
        for resource in root.iter('{%s}BibResource' % NS['dcndl']):
            if resource.find('dcterms:title', NS) is not None: return resource
        return None

    def _info(self, bib, resource):
        """dcndl 记录 → (标题, 艺人, releaseInfo)；介质不含 CD 返回 None。"""
        extent = _text(resource.find('dcterms:extent', NS))
        if 'CD' not in extent.upper(): return None
        ids = {el.get(RDF_TYPE, '').rsplit('/', 1)[-1]: _text(el) for el in resource.findall('dcterms:identifier', NS)}
        notes = [_text(d) for d in resource.findall('dcterms:description', NS)]
        label = next((n.split(':', 1)[1].strip() for n in notes if n.startswith('レーベル名')), '')
        publishers = [_text(a.find('foaf:name', NS)) for a in resource.findall('dcterms:publisher/foaf:Agent', NS)]
        if not label: label = next((p for p in publishers if p), '')
        count = re.search(r'(\d+)\s*枚', extent)
        discs = tracks([_text(p) for p in resource.findall('dcndl:partInformation/rdf:Description/dcterms:title', NS)])
        flat = [f"{n}-{row['position']} {row['title']}"[:500] for n, rows in sorted(discs.items()) for row in rows][:500]
        info = clean_release_info({
            'catalogNumber': ids.get('RIS502', ''), 'label': label,
            'country': _text(resource.find('dcndl:publicationPlace', NS)),
            'releaseDate': _date(_text(resource.find('dcterms:date', NS))),
            'format': 'CD', 'discCount': count[1] if count else '', 'tracklist': flat,
            'media': [{'position': n, 'format': 'CD', 'title': '', 'tracks': rows} for n, rows in sorted(discs.items())],
            'ndlBibId': bib})
        artist = ' / '.join(c for c in (_text(c) for c in resource.findall('dc:creator', NS)) if c)
        return _text(resource.find('dcterms:title', NS)), artist, info

    def _details(self, bib):
        if bib in self.details_cache: return self.details_cache[bib]
        resource = self._record(bib)
        result = self._info(bib, resource) if resource is not None else None
        if len(self.details_cache) >= 100: self.details_cache.clear()
        self.details_cache[bib] = result
        return result

    def search(self, barcode='', catno=''):
        """按唱片编号精确检索；NDL 不登记条码，条码查询返回空。"""
        if barcode or not _norm(catno): return []
        key = _norm(catno)
        if key in self.cache: return self.cache[key]
        found = []
        for bib in self._bib_ids(catno):
            detail = self._details(bib)
            if not detail: continue
            title, artist, info = detail
            summary = {k: v for k, v in info.items() if k not in ('tracklist', 'media')}
            found.append({'id': f'ndl-{bib}', 'source': 'ndl', 'title': title, 'artist': artist,
                          'releaseInfo': summary, 'identifierMatch': True,
                          'url': f'https://{API_HOST}/books/{REPOSITORY}{bib}'})
        if len(self.cache) >= 100: self.cache.clear()
        self.cache[key] = found
        return found

    def release_details(self, ident):
        match = IDENT.fullmatch(ident) if isinstance(ident, str) else None
        if not match: raise ValidationError('发行版本编号不正确')
        detail = self._details(match[1])
        if not detail: raise ValidationError('国会图书馆（NDL）没有这一 CD 条目')
        return detail[2]
