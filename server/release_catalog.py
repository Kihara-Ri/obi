"""MusicBrainz 发行版目录：按条码 / 唱片编号检索 CD 发行版本，读取发行版详情；运行时仅使用标准库。

照片识别与视觉模型已移除（数字实体的生成交给 Album Engine 项目）。"""
import json
import re
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler

from domain import ValidationError, clean_release_info


def display_release_title(value):
    """MusicBrainz uses square brackets for editorially supplied release titles."""
    title = str(value or '').strip()
    if len(title) > 2 and title[0] == '[' and title[-1] == ']' and '[' not in title[1:-1] and ']' not in title[1:-1]:
        return title[1:-1].strip()
    return title


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_json(url, timeout=35):
    headers = {'User-Agent':'Diedu/1.0 (personal CD catalog)', 'Accept':'application/json'}
    try:
        with build_opener(NoRedirect()).open(Request(url, None, headers), timeout=timeout) as response:
            body = response.read(2 * 1024 * 1024 + 1)
        if len(body) > 2 * 1024 * 1024: raise ValidationError('服务响应过大')
        return json.loads(body)
    except HTTPError as exc:
        labels = {429:'服务限流，请稍后重试'}
        raise ValidationError(labels.get(exc.code, f'服务返回 HTTP {exc.code}')) from None
    except (URLError, TimeoutError, OSError):
        raise ValidationError('无法连接服务或请求超时，请检查网络后重试') from None
    except (ValueError, UnicodeError):
        raise ValidationError('服务没有返回有效 JSON') from None


class ReleaseCatalog:
    def __init__(self, mb=None, discogs=None):
        self.mb = mb
        self.discogs = discogs   # 备用来源：MusicBrainz 没有收录时查 Discogs
        self.catalog_lock = threading.Lock(); self.catalog_at = 0; self.catalog_cache = {}
        self.release_cache = {}

    def _mb_json(self, url):
        """MusicBrainz 查询走全应用共用客户端（统一节流与冷却）；未注入时保留旧行为。
        调用方必须已持有 catalog_lock（旧路径的计时缓存也由它守护），这里不得重复加锁。"""
        if self.mb is not None:
            from musicbrainz import BadSource as MBBadSource, SourceUnavailable as MBUnavailable
            from musicbrainz import RateLimited
            try:
                try:
                    return self.mb.get_url(url)
                except RateLimited:
                    # 限流冷却通常只有几秒：短暂等待后重试一次，免得用户为一次瞬时 503 重来。
                    wait = self.mb.cooldown_remaining()
                    if not 0 < wait <= 3: raise
                    time.sleep(wait + 0.1)
                    return self.mb.get_url(url)
            except MBUnavailable as exc:
                raise ValidationError('发行资料库暂时不可用，请稍后重试') from exc
            except MBBadSource as exc:
                raise ValidationError('发行资料库返回了无效数据') from exc
        time.sleep(max(0, 1.1 - (time.monotonic() - self.catalog_at)))
        self.catalog_at = time.monotonic()
        return read_json(url)

    @staticmethod
    def candidate(r, barcode='', catno=''):
        """MusicBrainz release JSON → 候选（非 CD 或编号异常返回 None）。"""
        if not re.fullmatch(r'[0-9a-f-]{36}', str(r.get('id',''))): return None
        media = r.get('media',[])
        if not any('CD' in str(m.get('format','')) for m in media): return None
        labels = r.get('label-info',[])
        numbers = [l.get('catalog-number','') for l in labels if l.get('catalog-number')]
        digits = lambda s: re.sub(r'\D','',s)
        norm = lambda s:re.sub(r'[^\w]','',s).casefold()
        matched = bool(barcode and digits(barcode) and digits(barcode)==digits(r.get('barcode','')) or catno and any(norm(catno)==norm(n) for n in numbers))
        if barcode and catno:
            matched = digits(barcode)==digits(r.get('barcode','')) and any(norm(catno)==norm(n) for n in numbers)
        ri = clean_release_info({'catalogNumber':' / '.join(numbers), 'barcode':r.get('barcode',''),
            'label':' / '.join(l.get('label',{}).get('name','') for l in labels if l.get('label')),
            'country':r.get('country',''), 'releaseDate':'' if re.fullmatch(r'[0-]*', str(r.get('date') or '')) else r.get('date',''), 'edition':r.get('disambiguation',''),
            'packaging': r.get('packaging') or '', 'format':' + '.join(str(m.get('format','')) for m in media), 'discCount':str(len(media)) if media else ''})
        return {'id':r['id'],'title':display_release_title(r.get('title','')),
            'artist':''.join(a.get('name','') + a.get('joinphrase','') for a in r.get('artist-credit',[]) if isinstance(a,dict)),
            'releaseInfo':ri,'identifierMatch':matched,'url':'https://musicbrainz.org/release/' + r['id']}

    def catalog(self, fields):
        info = fields['releaseInfo']; barcode = info.get('barcode',''); catno = info.get('catalogNumber','')
        quote = lambda s:'"' + re.sub(r'([\\"+\-!():^\[\]{}~*?|&/])',r'\\\1',s) + '"'
        if barcode: query = 'barcode:' + quote(barcode)
        elif catno: query = 'catno:' + quote(catno)
        elif fields['title'] and fields['artist']: query = 'release:' + quote(fields['title']) + ' AND artist:' + quote(fields['artist'])
        else: return []
        with self.catalog_lock:
            if query in self.catalog_cache: return self.catalog_cache[query]
            data = self._mb_json('https://musicbrainz.org/ws/2/release/?' + urlencode({'query':query,'fmt':'json','limit':15}))
            candidates = [c for c in (self.candidate(r, barcode, catno) for r in data.get('releases',[])) if c]
            result = sorted(candidates,key=lambda r:r['identifierMatch'],reverse=True)[:15]
            if len(self.catalog_cache)>=200: self.catalog_cache.clear()
            self.catalog_cache[query] = result
            return result

    def fallback(self, barcode='', catno=''):
        """MusicBrainz 无精确匹配时的备用检索；未配置备用来源则返回空。"""
        return self.discogs.search(barcode, catno) if self.discogs else []

    def release_details(self, ident):
        if isinstance(ident,str) and ident.startswith('discogs-'):
            if not self.discogs: raise ValidationError('备用发行资料来源未启用')
            return self.discogs.release_details(ident)
        if not isinstance(ident,str) or not re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}',ident):
            raise ValidationError('发行版本编号不正确')
        with self.catalog_lock:
            if ident in self.release_cache: return self.release_cache[ident]
            r=self._mb_json('https://musicbrainz.org/ws/2/release/'+ident+'?'+urlencode({'fmt':'json','inc':'artist-credits+labels+recordings'}))
            media=r.get('media',[])
            if not any('CD' in str(m.get('format','')) for m in media): raise ValidationError('这一发行版本没有 CD 介质，请选择正确版本')
            labels=r.get('label-info',[])
            tracks, discs = [], []
            for i, disc in enumerate(media):
                disc_position = disc.get('position') if type(disc.get('position')) is int else i + 1
                disc_tracks = []
                for j, track in enumerate(disc.get('tracks') or []):
                    name = track.get('title') or (track.get('recording') or {}).get('title', '')
                    if not isinstance(name, str) or not name.strip(): continue
                    track_position = track.get('position') if type(track.get('position')) is int else j + 1
                    # Some MB CD releases have 'number' but omit 'position'.
                    if 'position' not in track and str(track.get('number', '')).isdigit():
                        track_position = int(track['number'])
                    row = {'position': track_position, 'title': name[:500]}
                    length = track.get('length')
                    if type(length) is not int: length = (track.get('recording') or {}).get('length')
                    if type(length) is int and 0 <= length <= 86400000: row['lengthMs'] = length
                    disc_tracks.append(row)
                    if len(tracks) < 500: tracks.append(f"{disc_position}-{track_position} {name}"[:500])
                discs.append({'position': disc_position, 'format': disc.get('format') or '',
                              'title': disc.get('title') or '', 'tracks': disc_tracks})
            info=clean_release_info({'catalogNumber':' / '.join(l.get('catalog-number','') for l in labels if l.get('catalog-number')),
                'barcode':r.get('barcode',''),'label':' / '.join(l.get('label',{}).get('name','') for l in labels if l.get('label')),
                'country':r.get('country',''),'releaseDate':r.get('date',''),'edition':r.get('disambiguation',''),
                'packaging':r.get('packaging') or '', 'format':' + '.join(str(m.get('format','')) for m in media),'discCount':str(len(media)), 'tracklist':tracks[:500], 'media':discs})
            if len(self.release_cache)>=200: self.release_cache.clear()
            self.release_cache[ident]=info
            return info

    def close(self):
        pass
