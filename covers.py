"""Album artwork download. Only the hosts in `artwork_url` (Apple / Cover Art Archive / Deezer / Bandcamp) may be fetched."""
from contextlib import closing
import sqlite3
from pathlib import Path
from urllib.error import HTTPError
import base64
import json
import re
import threading
import time
import unicodedata
from difflib import SequenceMatcher
from urllib.parse import urlencode, urlsplit, quote
from urllib.request import Request, build_opener, HTTPRedirectHandler
from domain import ValidationError
from cjkvariants import T2S
from kana import romaji
from musicbrainz import SourceUnavailable as MBSourceUnavailable, BadSource as MBBadSource


def normalized(text):
    # T→S 折叠让简体输入能对上繁体目录（周杰伦/周杰倫）；两侧同变换，只增容不改语义
    return ''.join(c for c in unicodedata.normalize('NFKC', text).casefold().translate(T2S) if c.isalnum())


def similarity(a, b):
    return SequenceMatcher(None, normalized(a), normalized(b)).ratio()


def artist_variants(artist):
    """Name forms worth trying: CV roles stripped, ＆/and members split, punctuation shed."""
    import re as _re
    base = unicodedata.normalize('NFKC', str(artist)).strip()
    out = [base]
    no_cv = _re.sub(r'\((?:CV\.?|cv)[:：]?\s*[^)]*\)', '', base)
    no_cv = _re.sub(r'\s+', ' ', no_cv).strip()
    if no_cv and no_cv != base: out.append(no_cv)
    for form in (no_cv or base, base):
        members = _re.split(r'[＆&]|※|、|/| x |×| X ', form)
        members = [m.strip() for m in members if m.strip()]
        if len(members) > 1:
            out.extend(members)
            out.append(' '.join(members))
    for v in list(out):
        shed = v.replace('!', '').replace('！', '').strip()
        if shed and shed not in out: out.append(shed)
    return [v for v in out if v]


def artist_matches(artist, who, loose=False):
    """Exact normalized equality, or fuzzy ≥ threshold against any variant."""
    who_n = normalized(who)
    if not who_n: return False
    threshold = 0.82 if loose else 0.9
    for v in artist_variants(artist):
        if normalized(v) == who_n: return True
        if similarity(v, who) >= threshold: return True
    return False


def artwork_url(url):
    p = urlsplit(url)
    hosts = ('archive.org', 'coverartarchive.org', 'cdn-images.dzcdn.net')
    allowed = (p.hostname and (p.hostname.endswith('.mzstatic.com') or p.hostname.endswith('.archive.org')
               or p.hostname.endswith('.bcbits.com') or p.hostname in hosts))
    if p.scheme != 'https' or not p.hostname or not allowed or p.username or p.password or p.port not in (None,443):
        raise ValidationError('封面来源不是受支持的图片地址')
    return url


class SafeRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlsplit(req.full_url).hostname in ('itunes.apple.com','musicbrainz.org'):
            if urlsplit(newurl).hostname != urlsplit(req.full_url).hostname or urlsplit(newurl).scheme != 'https':
                raise ValidationError('封面服务返回了不支持的跳转')
        else:
            artwork_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class CoverService:
    def __init__(self, cache_path=None, mb=None):
        self.cache_path = cache_path
        self.mb = mb  # MusicBrainzClient：MusicBrainz HTTP 路径接入全应用共用节流
        self.catalog_lock = threading.Lock()
        self.cache_lock = threading.Lock()   # 只保护响应缓存的读写，不含网络等待
        self.host_locks = {}                 # 按来源主机限速：不同主机的请求可以并行
        self.host_locks_guard = threading.Lock()
        self.responses = {}
        self.last_request = {}
        if cache_path:
            Path(cache_path).parent.mkdir(parents=True, exist_ok=True)
            with closing(sqlite3.connect(cache_path)) as db, db:
                db.execute("CREATE TABLE IF NOT EXISTS responses(url TEXT PRIMARY KEY, at REAL, data TEXT)")
        self.cache = {}
        self.choices = {}
        self.images = {}
        self.fallbacks = {}   # (标题, 艺人, 版本) → 退路封面候选或 None
        # RLock：search 持锁期间会调用 candidate，candidate 内也要登记 choices
        self.lock = threading.RLock()
        self.last_search = 0
        self.opener = build_opener(SafeRedirect())

    def read(self, url, limit):
        try:
            with self.opener.open(Request(url, headers={'User-Agent':'AlbumLedger/1.1 (personal local album inventory)','Accept':'application/json,image/*'}), timeout=12) as response:
                data = response.read(limit + 1)
                if len(data) > limit: raise ValidationError('封面文件过大，请改用手动上传')
                return data
        except HTTPError as exc:
            if exc.code == 404 and urlsplit(url).hostname == 'coverartarchive.org': return b'{}'
            raise ValidationError('封面资料库暂时不可用，请稍后重试') from exc
        except ValidationError:
            raise
        except Exception as exc:
            raise ValidationError('暂时无法连接封面服务，请稍后重试或手动上传') from exc

    def release_identity(self, release_id):
        """已确认 MusicBrainz 发行版的规范标题 / 艺人 / release-group（日版常署名与翻译名，iTunes 与目录用的是原名）。"""
        if not re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', str(release_id or '')): return None
        try:
            r=self.metadata('https://musicbrainz.org/ws/2/release/'+release_id+'?'+urlencode({'inc':'artist-credits+release-groups','fmt':'json'}))
        except ValidationError:
            return None
        g=r.get('release-group') or {}
        artist=''.join((c.get('artist') or {}).get('name','')+c.get('joinphrase','') for c in r.get('artist-credit',[]) if isinstance(c,dict))
        gid=g.get('id','') if re.fullmatch(r'[0-9a-f-]{36}',str(g.get('id',''))) else ''
        return {'title':g.get('title') or r.get('title',''),'artist':artist,'group':gid,'groupTitle':g.get('title','')}

    def search(self, title, artist, country='AUTO', release_id=None):
        title, artist = str(title).strip(), str(artist).strip()
        if not title or not artist: raise ValidationError('请先填写专辑名和艺人')
        if max(len(title),len(artist)) > 500: raise ValidationError('专辑名或艺人过长')
        if country == 'AUTO':
            result=self.layered_search(title, artist)
            ident=self.release_identity(release_id) if release_id else None
            if not ident or (normalized(ident['title'])==normalized(title) and normalized(ident['artist'])==normalized(artist)): return result
            return self.merge_identity(result, ident)
        if country not in ('JP','US'): raise ValidationError('请选择日本或美国资料库')
        key=(title, artist, country)
        with self.lock:
            hit=self.cache.get(key)
            if hit and time.monotonic()-hit[0]<3600: return hit[1]
            if time.monotonic()-self.last_search<3.1: raise ValidationError('查询较频繁，请稍等几秒后重试')
            self.last_search=time.monotonic()
            raw=self.read('https://itunes.apple.com/search?'+urlencode({'term':title+' '+artist,'country':country,'media':'music','entity':'album','limit':8}), 1024*1024)
            try: results=json.loads(raw).get('results',[])
            except (ValueError,AttributeError): raise ValidationError('封面服务返回的数据无法读取，请重试')
            candidates=[]
            for item in results:
                url=item.get('artworkUrl100','')
                if not url: continue
                try: artwork_url(url)
                except ValidationError: continue
                candidates.append(self.candidate(title,artist,item.get('collectionName',''),item.get('artistName',''),
                    f"{country}-{item.get('collectionId')}",url,str(item.get('releaseDate',''))[:4],country=country))
            candidates.sort(key=lambda x:x['score'],reverse=True)
            result={'candidates':candidates[:6],'source':'iTunes','country':country}
            self.cache[key]=(time.monotonic(),result)
            return result

    def merge_identity(self, result, ident):
        """用发行版的规范名再查一遍，并补上同一 release-group 的封面（版次可能不同，仅作展示、由用户点选）。"""
        more=[]
        if ident['title'] and ident['artist']:
            more=self.layered_search(ident['title'], ident['artist'])['candidates']
        if ident['group']:
            try:
                u=self.group_front(ident['group'])
                if u:
                    c=self.candidate(ident['title'],ident['artist'],ident['groupTitle'],ident['artist'],'CAA-'+ident['group'],u,
                                     provider='MusicBrainz / Cover Art Archive',page='https://musicbrainz.org/release-group/'+ident['group'])
                    c['exact']=False   # 同专辑不同版次的图，只作候选
                    more.append(c)
            except ValidationError:pass
        merged={}
        for c in list(result['candidates'])+more:
            merged.setdefault((normalized(c['artist']),album_key(c['title']),c['thumbnail']),c)
        out=sorted(merged.values(),key=lambda c:(c['exact'],c['score']),reverse=True)
        return {**result,'candidates':out[:8],'checked':result.get('checked',[])+['发行版规范名']}

    def download(self, token):
        with self.lock:
            if token in self.images: return self.images[token]
            item=self.choices.get(token)
        m=re.fullmatch(r'CAAR-([0-9a-f-]{36})',str(token))
        if not item and m:   # 此发行版的正面图：无需先搜索，由前端直接给出候选
            item={'url':f'https://coverartarchive.org/release/{m.group(1)}/front-1200','provider':'Cover Art Archive（此版本）',
                  'page':'https://musicbrainz.org/release/'+m.group(1),'title':'此版本的封面','artist':'','country':'AUTO'}
        if not item and isinstance(token, str) and token.startswith('https://'):
            # 用户直接给的封面地址（Bandcamp 专辑页右键复制的图片地址、Deezer 等）：
            # 只认受支持主机，仍走同一套落盘与备份。
            safe = artwork_url(token)
            host = urlsplit(safe).hostname or ''
            if 'dzcdn' in host: provider = 'Deezer（此版本）'
            elif 'bcbits' in host: provider = 'Bandcamp（此版本）'
            elif 'mzstatic' in host: provider = 'iTunes（此版本）'
            else: provider = 'Cover Art Archive（此版本）'
            item={'url':safe,'provider':provider,'page':'','title':'此版本的封面','artist':'','country':'AUTO'}
        if not item: raise ValidationError('候选封面已过期，请重新查找')
        data=self.read(artwork_url(item['url']),2*1024*1024)
        if data.startswith(b'\xff\xd8\xff'): mime='image/jpeg'
        elif data.startswith(b'\x89PNG\r\n\x1a\n'): mime='image/png'
        elif data.startswith(b'RIFF') and data[8:12]==b'WEBP': mime='image/webp'
        else: raise ValidationError('返回的文件不是受支持的封面图片')
        result={'cover':f'data:{mime};base64,'+base64.b64encode(data).decode(),
            'coverSource':{'provider':item.get('provider','iTunes'),'page':item.get('page',''),'title':item['title'],'artist':item['artist'],'url':item['url'],'country':item['country']}}
        with self.lock:self.images[token]=result
        return result

    def host_lock(self, host):
        with self.host_locks_guard:
            return self.host_locks.setdefault(host, threading.Lock())

    def cached_response(self, url):
        with self.cache_lock:
            hit = self.responses.get(url)
            if not hit and self.cache_path:
                with closing(sqlite3.connect(self.cache_path)) as db, db:
                    row = db.execute('SELECT at,data FROM responses WHERE url=?',(url,)).fetchone()
                    if row: hit = (row[0],json.loads(row[1]))
            if hit and time.time()-hit[0] < 7*86400: return hit[1]
        return None

    def metadata(self, url):
        """Cache source responses across albums/restarts; pace real network calls per source host,
        so iTunes and MusicBrainz / Cover Art Archive requests can run in parallel."""
        hit = self.cached_response(url)
        if hit is not None: return hit
        host=urlsplit(url).hostname
        with self.host_lock(host):
            hit = self.cached_response(url)   # 排队期间别的线程可能已取回同一资源
            if hit is not None: return hit
            if self.mb is not None and host == 'musicbrainz.org':
                # MusicBrainz 的节流交给共用客户端（含 429/503 冷却），本服务不再自行计时
                try:
                    result = self.mb.get_url(url)
                    if not isinstance(result, dict): raise MBBadSource('封面资料库返回了无效数据')
                except MBSourceUnavailable as exc:
                    raise ValidationError('封面资料库暂时不可用，请稍后重试') from exc
                except MBBadSource as exc:
                    raise ValidationError('封面资料库返回了无效数据') from exc
            else:
                interval=3.1 if host=='itunes.apple.com' else 1.1
                time.sleep(max(0,interval-(time.monotonic()-self.last_request.get(host,0))))
                self.last_request[host]=time.monotonic()
                try:
                    result=json.loads(self.read(url,4*1024*1024))
                    if not isinstance(result,dict): raise ValueError()
                except ValidationError:
                    raise
                except (ValueError,TypeError) as exc:
                    raise ValidationError('封面资料库返回了无效数据') from exc
        with self.cache_lock:
            self.responses[url]=(time.time(),result)
            if self.cache_path:
                with closing(sqlite3.connect(self.cache_path)) as db, db:
                    db.execute('INSERT OR REPLACE INTO responses VALUES(?,?,?)',(url,time.time(),json.dumps(result)))
        return result

    def artist_catalog(self, artist, country):
        base='https://itunes.apple.com/'
        matches=self.metadata(base+'search?'+urlencode({'term':artist,'entity':'musicArtist','limit':5,'country':country,'lang':'ja_jp' if country=='JP' else 'en_us'})).get('results',[])
        # Never silently adopt the first homonymous/unrelated artist.
        matches=[a for a in matches if artist_matches(artist, a.get('artistName',''), loose=True)]
        albums=[]
        for a in matches[:2]:
            data=self.metadata(base+'lookup?'+urlencode({'id':a['artistId'],'entity':'album','limit':200,'country':country,'lang':'ja_jp' if country=='JP' else 'en_us'}))
            albums.extend(x for x in data.get('results',[]) if x.get('collectionId'))
        return albums

    def candidate(self, title, artist, name, who, token, url, year='', provider='iTunes', page='', country='AUTO'):
        artwork_url(url)
        tk, nk = album_key(title), album_key(name)
        t_sim = similarity(tk, nk)
        # 标题是官方发行名的前缀（或反之）＝刻意用短名指代全名发行，按强匹配计；
        # 如「歌物語2」对应「歌物語2 -〈物語〉シリーズ主題歌集-」。exact 仍要求全等。
        if len(tk) >= 2 and len(nk) >= 2 and (nk.startswith(tk) or tk.startswith(nk)):
            t_sim = max(t_sim, .95)
        # iTunes 常把日文标题罗马字化（キセキ → Kiseki）：艺人对得上时，假名与罗马字等价算同名。
        same_artist = artist_matches(artist, who)
        if same_artist and tk != nk:
            rk, rn = album_key(romaji(title)), album_key(romaji(name))
            if rk == rn: tk, nk, t_sim = rk, rn, 1.0
        exact = tk == nk and same_artist
        c={'token':token,'title':name,'artist':who,'thumbnail':url,'year':year,'provider':provider,
           'score':round(.65*t_sim+.35*similarity(artist,who),3),'exact':exact}
        with self.lock: self.choices[token]={**c,'url':re.sub(r'/100x100bb\.', '/1200x1200bb.',url),'country':country,'page':page}
        return c

    def group_cd_front(self, gid):
        """Prefer a CD-format release's front art; vinyl covers often own the group slot."""
        try:
            releases=self.metadata('https://musicbrainz.org/ws/2/release?'+urlencode({'release-group':gid,'fmt':'json','limit':25,'inc':'media'})).get('releases',[])
        except ValidationError:
            return None
        cd=[r['id'] for r in releases if any('CD' in (m.get('format') or '') for m in r.get('media',[]))]
        for rid in cd[:2]:
            try:
                art=self.metadata('https://coverartarchive.org/release/'+rid)
                front=next((i for i in art.get('images',[]) if i.get('front') and i.get('approved')),None)
                if front:
                    u=front.get('thumbnails',{}).get('500') or front.get('thumbnails',{}).get('large') or front.get('image','')
                    if u.startswith('http://'):u='https://'+u[7:]
                    return u
            except ValidationError:
                continue
        return None

    def group_front(self, gid):
        """同一张专辑（release-group）的正面图：先找其中 CD 版本的，再退到专辑组自己的图；没有返回 None。"""
        url=self.group_cd_front(gid)
        if url:return url
        art=self.metadata('https://coverartarchive.org/release-group/'+gid)
        front=next((i for i in art.get('images',[]) if i.get('front') and i.get('approved')),None)
        if not front:return None
        url=front.get('thumbnails',{}).get('500') or front.get('thumbnails',{}).get('large') or front.get('image','')
        return 'https://'+url[7:] if url.startswith('http://') else url

    def fallback(self, title, artist, release_id=None):
        """版本自己没有正面图时的退路（版本卡片与选用后的自动匹配共用）：
        同一张专辑的封面（已确认 MusicBrainz 版本的 release-group；否则同名同艺人的专辑组）→ 同名同艺人的 iTunes 数字封面。
        只取名字精确对上的，宁可没有也不拿别的专辑；kind 说明借的是哪一种，界面据此提示「不一定是这个版本的包装」。"""
        title, artist = str(title).strip(), str(artist).strip()
        key=(title, artist, str(release_id or ''))
        with self.lock:
            if key in self.fallbacks: return self.fallbacks[key]
        found=None
        ident=self.release_identity(release_id) if release_id else None
        if ident and ident['group']:
            try:
                url=self.group_front(ident['group'])
                if url:
                    found={**self.candidate(ident['title'] or title, ident['artist'] or artist, ident['groupTitle'] or title,
                                            ident['artist'] or artist, 'CAA-'+ident['group'], url,
                                            provider='MusicBrainz / Cover Art Archive',
                                            page='https://musicbrainz.org/release-group/'+ident['group']), 'kind':'album'}
            except ValidationError: pass
        if not found and title and artist:
            choices=self.search(title, artist, 'AUTO', release_id)['candidates']
            album=next((c for c in choices if c['exact'] and 'Cover Art Archive' in c.get('provider','')), None)
            digital=next((c for c in choices if c['exact'] and c.get('provider')=='iTunes'), None)
            found={**album,'kind':'album'} if album else {**digital,'kind':'digital'} if digital else None
        with self.lock: self.fallbacks[key]=found
        return found

    def archive_candidates(self,title,artist):
        # Quoted Lucene values keep punctuation in album/artist names literal.
        lucene_quote=lambda v:'"'+v.replace('\\','\\\\').replace('"','\\"')+'"'
        url='https://musicbrainz.org/ws/2/release-group/?'+urlencode({'query':f'releasegroup:{lucene_quote(title)} AND artist:{lucene_quote(artist)}','fmt':'json','limit':5}, quote_via=quote)
        groups=self.metadata(url).get('release-groups',[])
        # Artist spellings vary wildly (CV roles, ！/!, ø); retry title-only and gate by score.
        if not groups:
            time.sleep(1.2)
            url='https://musicbrainz.org/ws/2/release-group/?'+urlencode({'query':f'releasegroup:{lucene_quote(title)}','fmt':'json','limit':10}, quote_via=quote)
            groups=self.metadata(url).get('release-groups',[])
        wanted=[]
        for g in groups[:4]:
            name=g.get('title','');who=''.join(c.get('name',c.get('artist',{}).get('name',''))+c.get('joinphrase','') for c in g.get('artist-credit',[]))
            if similarity(title,name)<.65 or not artist_matches(artist,who,loose=True):continue
            if not re.fullmatch(r'[0-9a-f-]{36}',g.get('id','')):continue
            wanted.append((g,name,who))
        # 各专辑组互不依赖：并行取图（MusicBrainz 仍由共用节流排队，CAA 是另一主机，可同时进行）
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=max(1,len(wanted))) as pool:
            futures=[pool.submit(self.group_front,g['id']) for g,_,_ in wanted]
        candidates=[]
        for (g,name,who),future in zip(wanted,futures):
            gid=g['id']
            try:url=future.result()
            except ValidationError:continue
            if not url:continue
            try:c=self.candidate(title,artist,name,who,'CAA-'+gid,url,g.get('first-release-date','')[:4],'MusicBrainz / Cover Art Archive','https://musicbrainz.org/release-group/'+gid)
            except ValidationError:continue
            # A group can represent different editions; multiple matches remain manual.
            if 'Live' in g.get('secondary-types',[]) and 'live' not in title.casefold():c['exact']=False
            candidates.append(c)
        return candidates

    def term_candidates(self, title, artist, country):
        """艺人目录查不中时的兜底腿：按「标题+艺人」关键词直搜 iTunes 目录（如合辑、
        艺人署名与目录不一致的发行）。候选走同一打分与 0.65 门槛。"""
        base='https://itunes.apple.com/'
        results=self.metadata(base+'search?'+urlencode({'term':title+' '+artist,'entity':'album','limit':8,'country':country,'lang':'ja_jp' if country=='JP' else 'en_us'})).get('results',[])
        out=[]
        for a in results:
            if not a.get('artworkUrl100'):continue
            c=self.candidate(title,artist,a.get('collectionName',''),a.get('artistName',''),f"{country}-{a['collectionId']}",a['artworkUrl100'],a.get('releaseDate','')[:4],page=a.get('collectionViewUrl',''),country=country)
            if c['score']>=.65:out.append(c)
        return out

    def itunes_leg(self,title,artist,stop=None,acc=None):
        """iTunes：艺人目录（日本→美国）→ 关键词直搜；任一步出现精确匹配即停，stop 置位也停。
        结果边查边写入 acc，调用方不必等整条腿跑完就能读到已有候选。"""
        acc=acc if acc is not None else {'candidates':[],'warnings':[],'checked':[]}
        candidates,warnings,checked=acc['candidates'],acc['warnings'],acc['checked']
        halted=lambda:bool(stop and stop.is_set())
        for country in ('JP','US'):
            if halted():return acc
            checked.append('iTunes '+country)
            try:
                for a in self.artist_catalog(artist,country):
                    if not a.get('artworkUrl100'):continue
                    c=self.candidate(title,artist,a.get('collectionName',''),a.get('artistName',''),f"{country}-{a['collectionId']}",a['artworkUrl100'],a.get('releaseDate','')[:4],page=a.get('collectionViewUrl',''),country=country)
                    if c['score']>=.65:candidates.append(c)
            except ValidationError as exc:warnings.append(f'iTunes {country}：{exc}')
            if any(c['exact'] for c in candidates):return acc
        for country in ('JP','US'):
            if halted():return acc
            checked.append(f'iTunes 关键词（{country}）')
            try:candidates.extend(self.term_candidates(title,artist,country))
            except ValidationError as exc:warnings.append(f'iTunes 关键词（{country}）：{exc}')
            if any(c['exact'] for c in candidates):break
        return acc

    def archive_leg(self,title,artist):
        candidates=[];warnings=[]
        try:candidates.extend(self.archive_candidates(title,artist))
        except ValidationError as exc:warnings.append(str(exc))
        return candidates,warnings,['MusicBrainz / Cover Art Archive']

    def layered_search(self,title,artist,hedge=2.0):
        """iTunes 与 MusicBrainz / CAA 是不同主机、各自限速，因此并行查：iTunes 迟迟没有精确匹配（>hedge 秒）
        或已跑完仍无精确匹配时启动 MusicBrainz 一腿；iTunes 很快精确命中则不打扰 MusicBrainz。
        任何一腿先拿到精确匹配就收工，另一腿被叫停（iTunes 逐步限速最慢，常是它在拖）。
        合并、排序、去重与串行版一致。"""
        from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
        exact=lambda cs:any(c['exact'] for c in cs)
        with self.catalog_lock:
            stop=threading.Event();acc={'candidates':[],'warnings':[],'checked':[]}
            pool=ThreadPoolExecutor(max_workers=2)
            try:
                itunes=pool.submit(self.itunes_leg,title,artist,stop,acc)
                archive=None
                done,_=wait([itunes],timeout=hedge)
                if not done or not exact(acc['candidates']):
                    archive=pool.submit(self.archive_leg,title,artist)
                pending={f for f in (itunes,archive) if f is not None}   # 已完成的也放进去，wait 会立刻返回
                more=([],[],[])
                while pending:
                    done,pending=wait(pending,return_when=FIRST_COMPLETED)
                    if archive in done:
                        more=archive.result()
                        if exact(more[0]):stop.set();break   # MusicBrainz 先命中：iTunes 剩余步骤不必再跑
                    if itunes in done and exact(acc['candidates']):break
                if archive and archive.done() and more==([],[],[]):more=archive.result()
            finally:
                stop.set();pool.shutdown(wait=False)   # 多余的一腿不再等待，只会在后台补缓存
            candidates=list(acc['candidates'])+list(more[0]);warnings=list(acc['warnings'])+list(more[1])
            checked=list(acc['checked'])+list(more[2])
            candidates.sort(key=lambda c:(c['exact'],c['score']),reverse=True)
            # Repeated catalog entries with the same title and image need one choice.
            unique={}
            for c in candidates:
                key=(normalized(c['artist']),album_key(c['title']),c['thumbnail'])
                unique.setdefault(key,c)
            return {'candidates':list(unique.values())[:6],'source':'自动多源','country':'AUTO','checked':checked,'warnings':warnings}


def album_key(title):
    """Ignore format/remaster labels, but preserve live/remix/deluxe identity."""
    title=re.sub(r'\s+-\s+(?:EP|Single)$','',title,flags=re.I)
    title=re.sub(r'\s*[\[(](?:(?:\d{4}\s+)?Remaster(?:ed)?(?:\s+\d{4})?)[\])]','',title,flags=re.I)
    return normalized(title)
