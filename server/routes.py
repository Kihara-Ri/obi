"""API 路由表。新增接口 = 写一个处理函数 + 在表里加一行。

GET 处理函数签名 fn(h, svc)；POST 为 fn(h, svc, body)。
h 提供 send()/query；svc 是注入的服务集合（见 context.Services）。
"""
import datetime
import hashlib
import base64
import mimetypes
import re
import threading
from urllib.parse import parse_qs, urlsplit

from domain import ValidationError, clean_start_page
from storage import SCHEMA
from . import export_csv
from .artists import SourceUnavailableError
from .version import uptime, version
from .listing_routes import (api_listing_status, api_listing_analyze, api_listing_job,
    api_listing_draft, api_listing_photos, api_listing_login, api_listing_disconnect,
    api_listing_provider, api_listing_models, api_listing_connection, api_listing_auth_code)

# 所有改状态的 store 调用共用一把锁，串行化并发写
WRITE_LOCK = threading.Lock()


def query(h):
    """URL 查询串 → 首值字典。浏览器 fetch 总是百分号编码；裸 UTF-8（如 curl 直连）按原字节recover。"""
    out = {}
    for key, values in parse_qs(urlsplit(h.path).query).items():
        fixed = []
        for v in values:
            try:
                fixed.append(v.encode('latin-1').decode('utf-8'))
            except (UnicodeEncodeError, UnicodeDecodeError):
                fixed.append(v)
        out[key] = fixed[0]
    return out


# ── GET ──────────────────────────────────────────────────────────────
def api_health(h, svc):
    """存活与版本探测：部署脚本和外部监控用，免登录，只暴露运行状态不暴露数据。"""
    try:
        with svc.store.connect() as db:
            db.execute('SELECT 1').fetchone()
    except Exception:
        return h.send({'ok': False, 'version': version(), 'error': 'database unavailable'}, 503)
    h.send({'ok': True, 'version': version(), 'schema': SCHEMA, 'uptime': uptime()})


def api_state(h, svc):
    state = svc.store.state()
    state['service'] = {'login': bool(svc.auth), 'version': version(),
                        'backup': svc.backups.status() if svc.backups else {}}
    h.send(state)


def api_shop_brands(h, svc):
    h.send({'brands': svc.shops.index() if svc.shops else {},
            'provider': svc.shops.status() if svc.shops else {'piInstalled': False}})


def api_shop_retry(h, svc, body):
    if not svc.shops: raise ValidationError('商家图标服务不可用')
    name = str(body.get('name', '')).strip()
    from .shop_brands import normalize
    with svc.store.connect() as db:
        known = any(normalize(r.get('location', '')) == normalize(name)
                    for r in svc.store.rows(db, 'records'))
    if not known: raise ValidationError('请先保存该购买渠道')
    h.send({'queued': svc.shops.schedule(name, retry=True)})


def api_shop_brand_icon(h, svc):
    name = urlsplit(h.path).path.split('/')[-1]
    if not svc.shops: raise ValidationError('商家图标服务不可用')
    h.send(svc.shops.icon(name), mime='image/png', cache='private, max-age=86400')


def api_rate(h, svc):
    d = query(h).get('date', '')
    h.send({'date': d, 'rate': svc.rates.get(d) if svc.rates else None})


def api_photo(h, svc):
    """实物照片 /api/photo/<32位hex记录id>/<序号>；序号按文件名排序取第一个扩展名匹配。"""
    parts = urlsplit(h.path).path.split('/')
    ok = (len(parts) == 5 and len(parts[3]) == 32
          and all(c in '0123456789abcdef' for c in parts[3]) and parts[4].isdigit())
    folder = svc.store.photos_dir / parts[3] if ok else None
    files = sorted(folder.glob(parts[4] + '.*')) if folder and folder.exists() else []
    if not files: return h.send({'error': '照片不存在'}, 404)
    return h.send(files[0].read_bytes(), mime=mimetypes.guess_type(files[0])[0] or 'image/jpeg')


def api_cover(h, svc):
    """封面文件 /api/cover/<16位内容哈希>.<jpg|png|webp>；内容寻址 → 可 immutable 长缓存。"""
    name = urlsplit(h.path).path.split('/')[-1]
    if not re.fullmatch(r'[0-9a-f]{16}\.(jpg|png|webp)', name):
        return h.send({'error': '封面不存在'}, 404)
    path = svc.store.covers_dir / name
    if not path.is_file(): return h.send({'error': '封面不存在'}, 404)
    mime = {'jpg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}[name.rsplit('.', 1)[1]]
    return h.send(path.read_bytes(), mime=mime, cache='private, max-age=31536000, immutable')


def api_album_favorites(h, svc):
    h.send(svc.store.album_favorites())


def api_album_favorite(h, svc, body):
    h.send(svc.store.set_album_favorite(body))


def api_backup(h, svc):
    h.send(svc.store.backup(), filename='album-ledger-backup.json')


def api_export(h, svc):
    stamp = datetime.date.today().strftime('%Y%m%d')
    if query(h).get('scope') == 'sales':
        return h.send(export_csv.sales_csv(svc.store.state()), mime='text/csv; charset=utf-8', filename=f'sales-{stamp}.csv')
    return h.send(export_csv.albums_csv(svc.store.state()), mime='text/csv; charset=utf-8', filename=f'albums-{stamp}.csv')


# ── POST：登录与会话 ──────────────────────────────────────────────────
def api_login(h, svc, body):
    if not svc.auth: return h.send({'ok': True})
    password = body.get('password', '')
    if not isinstance(password, str) or len(password) > 1024: raise ValidationError('密码格式不正确')
    token = svc.auth.login(password, h.client_address[0])
    h.send({'ok': True}, headers={'Set-Cookie': h.session_cookie(token)})


def api_logout(h, svc, body):
    if svc.auth: svc.auth.logout(h.headers.get('Cookie'))
    h.send({'ok': True}, headers={'Set-Cookie': h.session_cookie('', True)})


def api_password(h, svc, body):
    """改密：验证当前密码后换新；除当前会话外其他设备全部退出。"""
    current, new = body.get('current', ''), body.get('next', '')
    if not isinstance(current, str) or not isinstance(new, str) or len(current) > 1024 or len(new) > 1024:
        raise ValidationError('密码格式不正确')
    keep = svc.auth.token(h.headers.get('Cookie'))
    keep_hash = hashlib.sha256(keep.encode()).hexdigest() if keep else None
    svc.auth.change_password(current, new, keep_hash)
    h.send({'ok': True})


# ── POST：封面（只读缓存，不进写锁）─────────────────────────────────
def api_covers_search(h, svc, body):
    h.send(svc.covers.search(body.get('title', ''), body.get('artist', ''), body.get('country', 'AUTO')))


def api_covers_download(h, svc, body):
    h.send(svc.covers.download(body.get('token')))


# ── 艺人资料与作品目录：外网请求不持有写锁，storage 写入由服务内部短锁串行 ──
def artists(svc):
    if svc.artists is None: raise ValidationError('艺人资料服务未启动，请重启碟渡')
    return svc.artists


def prewarm(svc):
    """账本写入后台预取新艺人：同步扫描入队、异步取数，失败静默（不影响写请求）。"""
    if svc.artists is None: return
    try:
        svc.artists.enqueue_prewarm()
    except Exception:
        pass


def _unavailable(h, exc):
    h.send({'status': 'unavailable', 'error': str(exc)}, 503)


def api_artists_resolve(h, svc, body):
    try:
        h.send(artists(svc).resolve(body.get('artist', ''), body.get('searchName'),
                                    force=bool(body.get('force'))))
    except SourceUnavailableError as exc:
        _unavailable(h, exc)


def api_artists_bind(h, svc, body):
    try:
        binding = artists(svc).bind(body.get('artist', ''), body.get('artistMbid'),
                                    body.get('expectedArtistMbid'))
        h.send({'ok': True, 'binding': binding})
    except SourceUnavailableError as exc:
        _unavailable(h, exc)


def api_artists_profile(h, svc):
    q = query(h)
    try:
        h.send(artists(svc).profile(q.get('artist', ''), refresh=q.get('refresh') == '1'))
    except SourceUnavailableError as exc:
        h.send({'artist': q.get('artist', ''), 'status': 'unavailable', 'error': str(exc)}, 503)


def api_artists_catalog(h, svc):
    q = query(h)
    try:
        h.send(artists(svc).catalog(q.get('artist', ''), q.get('offset', 0),
                                    refresh=q.get('refresh') == '1', round_id=q.get('roundId')))
    except SourceUnavailableError as exc:
        h.send({'status': 'unavailable', 'error': str(exc)}, 503)


def api_artists_work_link(h, svc, body):
    try:
        link = artists(svc).work_link(body.get('artist', ''), body.get('recordId'),
                                      body.get('releaseGroupMbid'), body.get('expectedReleaseGroupMbid'),
                                      body.get('recordArtist', ''), body.get('recordTitle', ''))
        h.send({'ok': True, 'link': link})
    except SourceUnavailableError as exc:
        _unavailable(h, exc)


def api_artists_work_unlink(h, svc, body):
    h.send({'ok': True, **artists(svc).work_unlink(body.get('recordId'),
                                                   body.get('expectedReleaseGroupMbid'))})


def api_artists_artwork(h, svc):
    """作品缩略封面：无图 404、临时失败 503；只有本地目录缓存里出现过的作品 ID 可取。"""
    try:
        result = artists(svc).artwork(urlsplit(h.path).path.split('/')[-1])
    except SourceUnavailableError as exc:
        return h.send({'error': str(exc)}, 503)
    if result is None: return h.send({'error': '暂无封面'}, 404)
    h.send(result['data'], mime=result['mime'], cache='private, max-age=2592000')


# ── POST：账本写操作（全部走 WRITE_LOCK）────────────────────────────
def api_records(h, svc, body):
    # Discover only newly recorded purchase channels, after the ledger write commits.
    # The model can only suggest a favicon; it never overwrites the entered location.
    incoming = body.get('items') if isinstance(body, dict) and 'items' in body else [body]
    if not isinstance(incoming, list): incoming = []
    proposed = {str(item.get('location', '')).strip() for item in incoming if isinstance(item, dict)}
    proposed.discard('')
    from .shop_brands import normalize
    with svc.store.connect() as db:
        recorded = {normalize(r.get('location', '')) for r in svc.store.rows(db, 'records')}
    for item in incoming:
        if not isinstance(item, dict): continue
        info = item.get('releaseInfo') or {}
        if not isinstance(info, dict): continue
        new_barcode = info.get('barcode') or ''
        new_edition = info.get('musicBrainzReleaseId') or ''
        if not new_edition and info.get('discogsReleaseId'): new_edition = 'discogs-' + info['discogsReleaseId']
        manual = info.get('manualRelease') == '1' and not new_edition
        old_barcode = old_edition = ''
        if item.get('id'):
            with svc.store.connect() as db:
                previous = svc.store.get(db, 'records', item['id'])
            previous_info = previous.get('releaseInfo') or {}
            old_barcode = previous_info.get('barcode') or ''
            old_edition = previous_info.get('musicBrainzReleaseId') or ''
            if not old_edition and previous_info.get('discogsReleaseId'):
                old_edition = 'discogs-' + previous_info['discogsReleaseId']
        if manual:
            pass  # 两个资料库都没有收录：按用户手动录入的版本保存，不做资料库核对，也不伪造来源。
        elif (new_barcode, new_edition) != (old_barcode, old_edition):
            if new_barcode:
                verify_barcode_release(svc, new_barcode, new_edition)
            elif old_barcode and new_edition:
                # Removing an existing barcode cannot silently retain a release
                # that MusicBrainz documents as having one.
                details = releases(svc).release_details(new_edition)
                if details.get('barcode'):
                    raise ValidationError('该发行版在 MusicBrainz 中有条码，不能直接清除；请重新选择发行版')
            elif not new_edition and (old_edition or new_barcode):
                raise ValidationError('条码或发行版本已修改，请重新查询并确认发行版')
    h.send(svc.store.save(body))
    if svc.shops:
        for name in proposed:
            if normalize(name) not in recorded:
                try: svc.shops.schedule(name)
                except Exception: pass  # Icon discovery is best-effort, never part of the ledger transaction.
    prewarm(svc)
def api_bulk(h, svc, body):
    h.send(svc.store.bulk(body))
    prewarm(svc)
def api_sales(h, svc, body): h.send(svc.store.sell(body))
def api_sale_action(h, svc, body): h.send(svc.store.sale_action(body))
def api_sale_update(h, svc, body): h.send(svc.store.update_sale(body))
def api_shipments(h, svc, body): h.send(svc.store.ship(body))
def api_shipment_action(h, svc, body): h.send(svc.store.shipment_action(body))
def api_shipment_update(h, svc, body): h.send(svc.store.update_shipment(body))
def api_import(h, svc, body):
    h.send(svc.store.import_data(body.get('albums')))
    prewarm(svc)
def api_restore(h, svc, body):
    h.send(svc.store.restore_backup(body))
    prewarm(svc)
def api_modules(h, svc, body):
    start_page = clean_start_page(body['startPage']) if 'startPage' in body else None
    h.send(svc.store.set_modules(body.get('enabled'), start_page))
def api_showcase_groups(h, svc, body): h.send(svc.store.change_showcase_groups(body))


def releases(svc):
    if svc.releases is None: raise ValidationError('发行资料服务未启动，请重启碟渡')
    return svc.releases


def api_release(h, svc): h.send({'releaseInfo':releases(svc).release_details(query(h).get('id'))})
def lookup_sources(svc, barcode, catno, exact, hedge=1.5):
    """先查 MusicBrainz；没有精确匹配（或暂时不可用）再查备用来源 Discogs，并如实返回各来源结果。
    MusicBrainz 迟迟没有答复（>hedge 秒）时并行启动 Discogs，不让用户串行等两个来源；
    MusicBrainz 很快命中则不打扰 Discogs。两个来源都不可用才报错，都没有则返回空候选与 sources 说明。"""
    from concurrent.futures import ThreadPoolExecutor, TimeoutError as Slow
    sources = {}

    def musicbrainz():
        return exact(releases(svc).catalog({'title': '', 'artist': '',
            'releaseInfo': {'barcode': barcode, 'catalogNumber': catno}}))

    def discogs():
        return releases(svc).fallback(barcode, catno)

    def settle(name, future):
        try:
            found = future.result()
        except ValidationError as exc:
            sources[name] = str(exc)
            return []
        sources[name] = 'found' if found else 'none'
        return found

    with ThreadPoolExecutor(max_workers=2) as pool:
        mb = pool.submit(musicbrainz)
        dc = None
        try:
            mb.exception(timeout=hedge)
        except Slow:
            dc = pool.submit(discogs)
        candidates = settle('musicbrainz', mb)
        if not candidates:
            candidates = settle('discogs', dc or pool.submit(discogs))
    if not candidates and all(v not in ('none', 'found') for v in sources.values()):
        raise ValidationError('发行资料库暂时不可用，请稍后重试（' + '；'.join(sources.values()) + '）')
    return candidates, sources


def api_barcode_lookup(h, svc, body):
    """精确条形码检索 CD 发行版（MusicBrainz 优先，Discogs 备用），复用现有节流与缓存。"""
    barcode = body.get('barcode', '')
    from twins import clean_barcode
    barcode = clean_barcode(barcode)
    if not barcode: raise ValidationError('请输入完整的条形码')
    candidates, sources = lookup_sources(svc, barcode, '', lambda found: [c for c in found if c['identifierMatch']
        and re.sub(r'\D', '', c['releaseInfo'].get('barcode', '')) == barcode])
    h.send({'barcode': barcode, 'candidates': candidates, 'sources': sources})


def verify_barcode_release(svc, barcode, release_id):
    """Check the full barcode against the exact catalog release (MusicBrainz or Discogs), never by title."""
    from twins import clean_barcode, UUID
    barcode = clean_barcode(barcode)
    if not barcode: raise ValidationError('请输入完整的条形码')
    if isinstance(release_id, str) and release_id.startswith('discogs-'):
        if clean_barcode(releases(svc).release_details(release_id).get('barcode', '')) != barcode:
            raise ValidationError('Discogs 中该条码不属于当前发行版本，请重新查询并选择正确版本')
        return {'barcode': barcode, 'releaseId': release_id, 'valid': True}
    if not isinstance(release_id, str) or not UUID.fullmatch(release_id):
        raise ValidationError('请先查询并选择对应的发行版本')
    published = releases(svc).release_details(release_id)
    if clean_barcode(published.get('barcode', '')) != barcode:
        raise ValidationError('MusicBrainz 中该条码不属于当前发行版本，请重新查询并选择正确版本')
    return {'barcode': barcode, 'releaseId': release_id, 'valid': True}


def api_verify_barcode(h, svc, body):
    h.send(verify_barcode_release(svc, body.get('barcode'), body.get('releaseId')))


def api_catalog_number_lookup(h, svc, body):
    """Catalog number search; exact label catalog-number required, not a title guess."""
    raw = body.get('catalogNumber', '')
    if not isinstance(raw, str) or not 2 <= len(raw.strip()) <= 80:
        raise ValidationError('请输入完整的唱片编号')
    number = raw.strip()
    if not re.fullmatch(r'[\w ./+\-]+', number, re.UNICODE):
        raise ValidationError('唱片编号包含不支持的字符')
    normalized = lambda value: re.sub(r'[^\w]', '', str(value)).casefold()
    # A release may have multiple labels; compare each independently.
    candidates, sources = lookup_sources(svc, '', number, lambda found: [item for item in found
        if any(normalized(part) == normalized(number)
               for part in item.get('releaseInfo', {}).get('catalogNumber', '').split(' / '))])
    exact = candidates
    h.send({'catalogNumber': number, 'candidates': exact, 'sources': sources})



def catalog_art(svc):
    return getattr(svc, 'catalog_art', None) or twins(svc).art


def api_release_artwork(h, svc):
    """Selected edition's CAA artwork metadata; never search other releases by title."""
    from twins import UUID
    from server.catalog_art import ArtNotFound
    ident = query(h).get('id', '')
    if not isinstance(ident, str) or not UUID.fullmatch(ident):
        raise ValidationError('发行版本编号不正确')
    try:
        catalog = catalog_art(svc).catalog(ident)
    except ArtNotFound:
        return h.send({'id': ident, 'artwork': []})
    artwork = []
    for item in catalog.get('images', [])[:40]:
        if not isinstance(item, dict) or not str(item.get('id', '')).isdigit(): continue
        thumbs = item.get('thumbnails') or {}
        url = thumbs.get('small') or thumbs.get('250') or item.get('image') or ''
        if not isinstance(url, str) or not url.startswith('https://'): url = ''
        artwork.append({'id': str(item['id']), 'types': item.get('types', []),
                        'thumbnail': url})
    h.send({'id': ident, 'artwork': artwork})


def api_release_front_cover(h, svc):
    """Use ONLY the front of the confirmed MB release, not title-matched unrelated editions."""
    from twins import UUID, image_type
    from server.catalog_art import ArtNotFound
    import base64
    ident = query(h).get('id', '')
    if not isinstance(ident, str) or not UUID.fullmatch(ident):
        raise ValidationError('发行版本编号不正确')
    try:
        images = catalog_art(svc).catalog(ident).get('images', [])
    except ArtNotFound:
        return h.send({'cover': '', 'reason': 'no-artwork'})
    front = next((item for item in images if isinstance(item, dict) and str(item.get('id', '')).isdigit()
                  and 'Front' in item.get('types', [])), None)
    if front is None: return h.send({'cover': '', 'reason': 'no-front'})
    raw = catalog_art(svc).image(ident, str(front['id']), preview=True)
    if len(raw) > 2500000: raise ValidationError('这一发行版的封面预览过大，请手动选择封面')
    _, mime = image_type(raw)
    h.send({'cover': 'data:' + mime + ';base64,' + base64.b64encode(raw).decode('ascii'),
            'coverSource': {'title': '', 'artist': ''}})


def api_engine_plugin(h, svc): h.send(svc.plugins.status())
def api_engine_install(h, svc, body): h.send(svc.plugins.install(body.get('expectedRevision')))
def api_engine_uninstall(h, svc, body): h.send(svc.plugins.uninstall(body.get('expectedRevision')))
def api_engine_asset(h, svc):
    from urllib.parse import unquote
    tail = unquote(urlsplit(h.path).path[len('/api/plugins/album-engine/assets/'):])
    version, separator, name = tail.partition('/')
    if not separator: raise ValidationError('插件资源地址无效')
    path = svc.plugins.asset(name, version=version)
    # 资源地址带插件版本、内容由清单 sha256 固定：之前一律 no-store，每次点 3D 都要重下 Three.js 与数 MB 的 GLB。
    # 现在带强 ETag，一天内直接命中浏览器缓存，过期后 304 重新校验；同版本重装内容不变，不会读到旧文件。
    digest = svc.plugins.asset_digest(name)
    etag = f'"{digest}"' if digest else None
    cache = 'private, max-age=86400'
    if etag and h.headers.get('If-None-Match') == etag: return h.not_modified(etag, cache)
    h.send(path.read_bytes(), mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream', cache=cache if etag else None, etag=etag)
def api_twin_model_asset(h, svc):
    parts = urlsplit(h.path).path.split('/')
    if len(parts) != 5: raise ValidationError('模型资源地址无效')
    path = svc.store.published_twin_model_asset(parts[3], parts[4])
    h.send(path.read_bytes(), mime=mimetypes.guess_type(parts[4])[0] or 'application/octet-stream', cache='private, max-age=31536000, immutable')


def twins(svc):
    if svc.twins is None: raise ValidationError('数字实体服务未启动，请重启碟渡')
    return svc.twins


def api_twins(h, svc): h.send(twins(svc).index())
def api_twin_accessories(h, svc, body): h.send(twins(svc).update_accessories(body))


def api_twin_disc_calibration(h, svc, body):
    if getattr(svc, 'plugins', None): svc.plugins.service()
    h.send(svc.store.set_twin_disc_calibration(body))
def api_twin_spine(h, svc, body):
    if getattr(svc, 'plugins', None): svc.plugins.service()
    h.send(svc.store.set_twin_spine_surface(body))

def api_twin_review_asset(h, svc):
    parts = urlsplit(h.path).path.split('/')
    if len(parts) != 5: raise ValidationError('发行资料预览地址无效')
    path = svc.store.review_twin_asset(parts[3], parts[4])
    h.send(path.read_bytes(), mime=mimetypes.guess_type(path.name)[0] or 'image/jpeg', cache='private, max-age=31536000, immutable')
def api_twin_source_preview(h, svc):
    parts = urlsplit(h.path).path.split('/')
    if len(parts) != 5 or not parts[4].isdigit() or len(parts[4]) > 2:
        raise ValidationError('人工选图预览地址无效')
    raw = twins(svc).guided_image(parts[3], int(parts[4]), query(h).get('source'))
    from twins import image_type
    _, mime = image_type(raw)
    h.send(raw, mime=mime, cache='private, max-age=3600')

def api_twin_asset(h, svc):
    parts = urlsplit(h.path).path.split('/')
    if len(parts) != 5: raise ValidationError('数字实体资源地址无效')
    path = svc.store.published_twin_asset(parts[3], parts[4])
    h.send(path.read_bytes(), mime=mimetypes.guess_type(path.name)[0] or 'image/jpeg', cache='private, max-age=31536000, immutable')


def api_import_preview(h, svc, body):
    p = svc.store.import_preview(body.get('albums'))
    h.send({'count': len(p['records']), 'skipped': p['skipped'], 'errors': p['errors'],
            'titles': [r['title'] for r in p['records'][:8]]})


# ── 路由表 ───────────────────────────────────────────────────────────
GET = {
    '/api/health': api_health,
    '/api/state': api_state,
    '/api/album-favorites': api_album_favorites,
    '/api/rate': api_rate,
    '/api/shop-brands': api_shop_brands,
    '/api/backup': api_backup,
    '/api/artists/profile': api_artists_profile,
    '/api/artists/catalog': api_artists_catalog,
    '/api/export': api_export,
    '/api/release-details': api_release,
    '/api/catalog/artwork': api_release_artwork,
    '/api/catalog/front-cover': api_release_front_cover,
    '/api/plugins/album-engine': api_engine_plugin,
    '/api/twins': api_twins,
    '/api/twin-source-preview/': api_twin_source_preview,
}
PUBLIC_GET = {  # 免登录（监控与部署探测）
    '/api/health',
}
GET_PREFIX = {  # 带路径参数的接口
    '/api/photo/': api_photo,
    '/api/cover/': api_cover,
    '/api/shop-brand-icon/': api_shop_brand_icon,
    '/api/artists/artwork/': api_artists_artwork,
    '/api/plugins/album-engine/assets/': api_engine_asset,
    '/api/twin-model-assets/': api_twin_model_asset,
    '/api/twin-assets/': api_twin_asset,
    '/api/twin-review-assets/': api_twin_review_asset,
}
GET.update({'/api/listing/status': api_listing_status, '/api/listing/job': api_listing_job,
            '/api/listing/photos': api_listing_photos, '/api/listing/models': api_listing_models})
POST = {
    # path: (处理函数, 需要登录, 需要 WRITE_LOCK)
    '/api/login': (api_login, False, False),
    '/api/logout': (api_logout, True, False),
    '/api/password': (api_password, True, True),
    '/api/listing/analyze': (api_listing_analyze, True, True),
    '/api/listing/draft': (api_listing_draft, True, True),
    '/api/listing/login': (api_listing_login, True, False),
    '/api/listing/disconnect': (api_listing_disconnect, True, False),
    '/api/listing/provider': (api_listing_provider, True, False),
    '/api/listing/connection': (api_listing_connection, True, False),
    '/api/listing/auth-code': (api_listing_auth_code, True, False),
    '/api/catalog/barcode': (api_barcode_lookup, True, False),
    '/api/catalog/barcode/verify': (api_verify_barcode, True, False),
    '/api/catalog/number': (api_catalog_number_lookup, True, False),
    '/api/shops/retry': (api_shop_retry, True, False),
    '/api/covers/search': (api_covers_search, True, False),
    '/api/covers/download': (api_covers_download, True, False),
    '/api/artists/resolve': (api_artists_resolve, True, False),
    '/api/artists/bind': (api_artists_bind, True, False),
    '/api/artists/work-link': (api_artists_work_link, True, False),
    '/api/artists/work-unlink': (api_artists_work_unlink, True, False),
    '/api/records': (api_records, True, True),
    '/api/album-favorites': (api_album_favorite, True, True),
    '/api/bulk': (api_bulk, True, True),
    '/api/sales': (api_sales, True, True),
    '/api/sale-action': (api_sale_action, True, True),
    '/api/sale-update': (api_sale_update, True, True),
    '/api/shipments': (api_shipments, True, True),
    '/api/shipment-action': (api_shipment_action, True, True),
    '/api/shipment-update': (api_shipment_update, True, True),
    '/api/import-preview': (api_import_preview, True, True),
    '/api/import': (api_import, True, True),
    '/api/restore': (api_restore, True, True),
    '/api/modules': (api_modules, True, True),
    '/api/showcase/groups': (api_showcase_groups, True, True),
    '/api/plugins/album-engine/install': (api_engine_install, True, True),
    '/api/plugins/album-engine/uninstall': (api_engine_uninstall, True, True),
    '/api/twins/accessories': (api_twin_accessories, True, True),
    '/api/twins/disc-calibration': (api_twin_disc_calibration, True, True),
    '/api/twins/spine': (api_twin_spine, True, True),
}

# 允许跨站（外部页面）调用的写接口；当前为空，保留豁免管线供未来令牌鉴权回调使用
CROSS_SITE_POST: set = set()


def resolve_get(path):
    if path in GET: return GET[path]
    for prefix, fn in GET_PREFIX.items():
        if path.startswith(prefix): return fn
    return None


def resolve_post(path):
    return POST.get(path)
