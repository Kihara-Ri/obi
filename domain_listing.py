"""售卖草稿协议：保留观察来源与人工确认，不参与库存/金额语义。"""
from domain import ValidationError


def text(value, limit=2000):
    if not isinstance(value, str) or len(value) > limit:
        raise ValidationError('售卖资料文字无效或过长')
    return value.strip()


def photo_order(value, count=30):
    if (not isinstance(value, list) or len(value) > 30
            or any(type(i) is not int or not 0 <= i < count for i in value)
            or len(set(value)) != len(value)):
        raise ValidationError('照片选择无效，请重新选择')
    return list(value)


def clean_analysis(value):
    if not isinstance(value, dict): raise ValidationError('照片分析格式无效')
    out = {}
    for key in ('identifiers', 'observations'):
        rows = value.get(key, [])
        if not isinstance(rows, list) or len(rows) > 60: raise ValidationError('照片分析条目无效')
        out[key] = []
        for row in rows:
            if not isinstance(row, dict): raise ValidationError('照片分析条目无效')
            photos = photo_order(row.get('photos'))
            if not photos: raise ValidationError('照片分析缺少照片依据')
            item = {'text': text(row.get('text')), 'photos': photos}
            if key == 'identifiers':
                kind = row.get('kind')
                if kind not in ('barcode', 'catalogNumber', 'matrix', 'other'):
                    raise ValidationError('发行标识种类无效')
                item['kind'] = kind
            out[key].append(item)
    pending = value.get('pending', [])
    if not isinstance(pending, list) or len(pending) > 30: raise ValidationError('待确认项无效')
    out['pending'] = [text(item) for item in pending]
    candidates = value.get('candidates', [])
    if not isinstance(candidates, list) or len(candidates) > 30: raise ValidationError('版本候选无效')
    out['candidates'] = [{k: text(row.get(k, ''), 1000) for k in
                          ('id', 'title', 'artist', 'country', 'date', 'catalogNumber', 'barcode')}
                         for row in candidates if isinstance(row, dict)]
    out['catalogError'] = text(value.get('catalogError', ''))
    revision = value.get('photoRevision', 0)
    if type(revision) is not int or revision < 0: raise ValidationError('照片版本无效')
    out['photoRevision'] = revision
    return out


def clean_draft(value):
    if not isinstance(value, dict): raise ValidationError('售卖草稿格式无效')
    out = {key: text(value.get(key, ''), limit) for key, limit in
           (('title', 500), ('description', 50000), ('versionText', 3000),
            ('conditionText', 6000), ('selectedRelease', 100))}
    out['photoOrder'] = photo_order(value.get('photoOrder'))
    revision = value.get('photoRevision')
    if type(revision) is not int or revision < 0: raise ValidationError('照片版本无效')
    out['photoRevision'] = revision
    for key in ('versionConfirmed', 'conditionConfirmed'):
        if type(value.get(key)) is not bool: raise ValidationError('请确认版本和品相状态')
        out[key] = value[key]
    if value.get('analysis') is not None: out['analysis'] = clean_analysis(value['analysis'])
    return out
