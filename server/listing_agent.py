"""Agent 售卖接口的独立鉴权及按副本的草稿契约。"""
from contextlib import closing
import re

from domain import ValidationError
from domain_listing import has_listing_copy, photo_order, select_preset, text
from .agent_auth import authorize_agent, load_secret
from .listing_context import public_context
from .listing_photos import listing_record
from .release_merge import _catnos, _code

PAGE_SIZE = 20
DRAFT_FIELDS = frozenset(('id', 'revision', 'photoRevision', 'title', 'description',
                          'photoOrder', 'replaceExisting'))


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


def api_agent_copies(h, svc):
    from .routes import query
    params = query(h)
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
    with closing(svc.store.connect()) as db:
        svc.store.require_module('trading', db)
        copies = [r for r in svc.store.rows(db, 'records') if r.get('status') in ('domestic', 'overseas')
                  and _matches(r, by, value)]
    copies.sort(key=lambda r: (r['artist'].casefold(), r['title'].casefold(), r['id']))
    end = offset + PAGE_SIZE
    h.send({'copies': [_candidate(r) for r in copies[offset:end]],
            'nextOffset': end if end < len(copies) else None})


def _material_photo_order(record, saved):
    count = record.get('photoCount', 0)
    if saved.get('photoRevision') == record.get('photoRevision', 0):
        try:
            return photo_order(saved.get('photoOrder'), count)
        except ValidationError:
            pass
    return list(range(count))


def api_agent_materials(h, svc):
    from .routes import query
    record = listing_record(svc.store, query(h).get('id', ''))
    preferences = svc.store.listing_preferences()
    preset = select_preset(preferences, preferences['defaultPreset'])
    saved = record.get('listingDraft') or {}
    draft = None
    if has_listing_copy(record):
        draft = {'title': saved.get('title', ''),
                 'description': saved.get('description') or record.get('listingDescription', '')}
    h.send({'id': record['id'], 'revision': record['revision'],
            'photoRevision': record.get('photoRevision', 0), 'photoCount': record.get('photoCount', 0),
            'photoOrder': _material_photo_order(record, saved), 'listed': bool(record.get('listed')),
            'facts': public_context(record), 'draft': draft,
            'writingPreset': {key: preset[key] for key in ('id', 'name', 'instructions')}})


def api_agent_save_draft(h, svc, body):
    if body.keys() - DRAFT_FIELDS:
        raise ValidationError('这里只接收上架草稿字段')
    rid, revision = body.get('id'), body.get('revision')
    replace = body.get('replaceExisting', False)
    if not isinstance(rid, str) or type(revision) is not int or revision < 0 or type(replace) is not bool:
        raise ValidationError('副本、记录版本或替换选项无效')
    title = text(body.get('title'), 500)
    description = text(body.get('description'), 50000)
    if not title or not description:
        raise ValidationError('请提供标题和正文')
    draft = {'title': title, 'description': description, 'photoRevision': body.get('photoRevision'),
             'photoOrder': body.get('photoOrder'), 'versionConfirmed': False, 'conditionConfirmed': False}
    h.send(svc.store.save_listing_draft({'id': rid, 'revision': revision, 'draft': draft},
                                       replace_existing=replace))
