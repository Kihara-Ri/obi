"""Read-only purchase search for clients with a dedicated collection credential."""
from domain import ValidationError
from .agent_auth import load_secret, scope_guard
from .copy_search import lookup_value, matches_copy

PAGE_SIZE = 20
COPY_STATUSES = {'domestic': 'held', 'overseas': 'held', 'transit': 'in_transit',
                 'shipping': 'sale_pending', 'sold': 'resold', 'trash': 'removed'}


def load_collection_read_secret(data_dir):
    return load_secret(data_dir, 'collection-read.token', b'obi_collection_', '已购唱片查询')


authorize_collection_read = scope_guard('collection:read', '已购唱片查询')


def api_purchased_copies(h, svc):
    from .routes import query
    params = query(h)
    if params.keys() - {'q', 'by', 'status', 'offset'}:
        raise ValidationError('仅接受 q、by、status 和 offset')
    term = params.get('q', '')
    if not term.strip() or len(term) > 200:
        raise ValidationError('请输入 1–200 字的查找内容')
    offset = int(params.get('offset', '0'))
    wanted = params.get('status')
    if offset < 0 or (wanted is not None and wanted not in COPY_STATUSES.values()):
        raise ValidationError('分页位置或副本状态无效')
    by = params.get('by', 'text')
    value = lookup_value(by, term.strip())

    copies = []
    for record in svc.store.purchased_copies():
        status = COPY_STATUSES.get(record['status'])
        if status is None or (wanted is not None and status != wanted) or not matches_copy(record, by, value):
            continue
        release = record['releaseInfo']
        copies.append({'artist': record['artist'], 'title': record['title'], 'status': status,
                       **{key: record[key] or None for key in ('version', 'pressing', 'obi')},
                       **{key: release[key] or None for key in ('catalogNumber', 'barcode', 'country',
                                                                'edition', 'format')}})
    copies.sort(key=lambda copy: (copy['artist'].casefold(), copy['title'].casefold()))
    end = offset + PAGE_SIZE
    h.send({'copies': copies[offset:end], 'nextOffset': end if end < len(copies) else None})
