"""用独立令牌查找库存副本并导出一个版本固定的资料包。"""
from contextlib import closing
import io
import json
from zipfile import ZipFile

from domain import ConflictError, ValidationError
from domain_listing import photo_order, text
from .agent_auth import load_secret, scope_guard
from .copy_search import lookup_value, matches_copy
from .listing_context import public_context
from .listing_photos import listing_record, read_photos

PAGE_SIZE = 20


def load_agent_secret(data_dir):
    return load_secret(data_dir, 'listing-agent.token', b'obi_listing_', '上架 Agent')


authorize_listing_agent = scope_guard('listing:read', '上架 Agent')


def _candidate(record):
    release = record.get('releaseInfo') or {}
    return {**{key: record.get(key, '') for key in
               ('id', 'title', 'artist', 'version', 'pressing', 'obi', 'status')},
            'catalogNumber': release.get('catalogNumber', ''), 'barcode': release.get('barcode', ''),
            'listed': bool(record.get('listed'))}


def _candidates(store, params):
    if params.keys() - {'q', 'by', 'offset'}:
        raise ValidationError('查找模式只接受 q、by 和 offset')
    by = params.get('by', 'text')
    term = text(params.get('q', ''), 200)
    offset = int(params.get('offset', '0'))
    if not term or offset < 0:
        raise ValidationError('请提供查找内容和有效的分页位置')
    value = lookup_value(by, term)
    with closing(store.connect()) as db:
        store.require_module('trading', db)
        copies = [r for r in store.rows(db, 'records') if r.get('status') in ('domestic', 'overseas')
                  and matches_copy(r, by, value)]
    copies.sort(key=lambda r: (r['artist'].casefold(), r['title'].casefold(), r['id']))
    end = offset + PAGE_SIZE
    return {'copies': [_candidate(r) for r in copies[offset:end]],
            'nextOffset': end if end < len(copies) else None}


def _material_photo_order(record, saved):
    count = record.get('photoCount', 0)
    if saved.get('photoRevision') == record.get('photoRevision', 0):
        try:
            return photo_order(saved.get('photoOrder'), count)
        except ValidationError:
            pass
    return list(range(count))


def _package_order(params, record, saved):
    revision = record.get('photoRevision', 0)
    if 'photoRevision' in params and int(params['photoRevision']) != revision:
        raise ConflictError('照片已变更，请重新核对')
    if params.get('photos') == '0' and 'order' not in params:
        return []
    if 'photos' in params:
        raise ValidationError('仅用 photos=0 请求无图资料包')
    if 'order' in params:
        if 'photoRevision' not in params:
            raise ValidationError('指定照片顺序时须提供照片版本')
        return photo_order([int(index) for index in params['order'].split(',')], record.get('photoCount', 0))
    return _material_photo_order(record, saved)


def _prepare(store, params, *, expected_revision=None):
    if params.keys() - {'id', 'order', 'photoRevision', 'photos'}:
        raise ValidationError('打包模式只接受 id、order、photoRevision 和 photos')
    record = listing_record(store, params['id'], expected_revision=expected_revision)
    return record, _package_order(params, record, record.get('listingPreparation') or {})


def _manifest(record, order):
    return {'id': record['id'], 'revision': record['revision'], 'photoRevision': record.get('photoRevision', 0),
            'photoCount': record.get('photoCount', 0), 'photoOrder': order, 'photos': [],
            'listed': bool(record.get('listed')), 'facts': public_context(record)}


def package_preview(store, params):
    """资料包清单（不读原图）：MCP 先给清单和下载链接，原图由调用方按需下载。"""
    record, order = _prepare(store, params)
    manifest = _manifest(record, order)
    manifest['photos'] = [{'index': index, 'position': position} for position, index in enumerate(order, 1)]
    return manifest


def _package(store, params, *, expected_revision=None):
    record, order = _prepare(store, params, expected_revision=expected_revision)
    rid = record['id']
    revision = record.get('photoRevision', 0)
    images = []
    if order:
        snapshot, images = read_photos(store, rid, order, revision)
        if snapshot['revision'] != record['revision']:
            raise ConflictError('副本已变更，请重新获取资料包')
    manifest = _manifest(record, order)
    output = io.BytesIO()
    with ZipFile(output, 'w') as archive:
        for position, (index, extension, content) in enumerate(images, 1):
            file = f'photos/{position:02d}{extension}'
            archive.writestr(file, content)
            manifest['photos'].append({'index': index, 'file': file})
        archive.writestr('materials.json', json.dumps(manifest, ensure_ascii=False))
    return output.getvalue()


def api_agent_package(h, svc):
    from .routes import WRITE_LOCK, query
    params = query(h)
    if 'id' in params:
        with WRITE_LOCK:
            package = _package(svc.store, params)
        h.send(package, mime='application/zip', filename='obi-listing-package.zip')
    else:
        h.send(_candidates(svc.store, params))
