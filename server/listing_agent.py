"""用独立令牌查找库存副本并导出一个版本固定的资料包。"""
from contextlib import closing
import io
import json
import re
from zipfile import ZipFile

from domain import ConflictError, ValidationError
from domain_listing import has_listing_copy, photo_order, text
from .agent_auth import authorize_agent, load_secret
from .listing_context import public_context
from .listing_photos import listing_record, read_photos
from .release_merge import _catnos, _code

PAGE_SIZE = 20


def load_agent_secret(data_dir):
    return load_secret(data_dir, 'listing-agent.token', b'obi_listing_', '上架 Agent')


def authorize_listing_agent(h, svc):
    return authorize_agent(h, svc.listing_agent_secret, '上架 Agent')


def _matches(record, by, query):
    release = record.get('releaseInfo') or {}
    if by == 'barcode':
        return query == _code(release.get('barcode'))
    if by == 'catalogNumber':
        return query in _catnos(release.get('catalogNumber'))
    name = f"{record.get('artist', '')} {record.get('title', '')}".casefold()
    return all(term in name for term in query)


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
    if by == 'barcode':
        if not re.fullmatch(r'[0-9 -]+', term) or not (value := _code(term)):
            raise ValidationError('请提供有效条码')
    elif by == 'catalogNumber':
        numbers = _catnos(term)
        if len(numbers) != 1:
            raise ValidationError('请提供一个唱片编号')
        value = next(iter(numbers))
    elif by == 'text':
        value = term.casefold().split()
    else:
        raise ValidationError('查找方式无效')
    with closing(store.connect()) as db:
        store.require_module('trading', db)
        copies = [r for r in store.rows(db, 'records') if r.get('status') in ('domestic', 'overseas')
                  and _matches(r, by, value)]
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


def _package(store, params):
    if params.keys() - {'id', 'order', 'photoRevision', 'photos'}:
        raise ValidationError('打包模式只接受 id、order、photoRevision 和 photos')
    rid = params['id']
    record = listing_record(store, rid)
    saved = record.get('listingDraft') or {}
    order = _package_order(params, record, saved)
    revision = record.get('photoRevision', 0)
    images = []
    if order:
        snapshot, images = read_photos(store, rid, order, revision)
        if snapshot['revision'] != record['revision']:
            raise ConflictError('副本已变更，请重新获取资料包')
    draft = None
    if has_listing_copy(record):
        draft = {'title': saved.get('title', ''),
                 'description': saved.get('description') or record.get('listingDescription', '')}
    manifest = {'id': rid, 'revision': record['revision'], 'photoRevision': revision,
                'photoCount': record.get('photoCount', 0), 'photoOrder': order, 'photos': [],
                'listed': bool(record.get('listed')), 'facts': public_context(record), 'draft': draft}
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
