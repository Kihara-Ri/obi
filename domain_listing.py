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
    conflicts = value.get('conflicts', [])
    if not isinstance(conflicts, list) or len(conflicts) > 30: raise ValidationError('版本冲突条目无效')
    out['conflicts'] = [text(item) for item in conflicts]
    for key, limit in (('versionText', 3000), ('conditionText', 6000), ('saleTerms', 3000)):
        out[key] = text(value.get(key, ''), limit)
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
    if value.get('generation') is not None:
        generation = value['generation']
        if not isinstance(generation, dict): raise ValidationError('生成资料无效')
        out['generation'] = {key: text(generation.get(key, ''), limit) for key, limit in
                             (('presetId', 100), ('presetName', 60), ('instructions', 6000),
                              ('supplement', 6000), ('contextHash', 64), ('sourceContext', 50000), ('provider', 50), ('model', 150))}
    return out


BUILTIN_PRESETS = (
    {'id': 'concise', 'name': '简洁直售', 'instructions': '语气自然，简洁直接。依次说明基本身份、版本、品相与附件，避免营销词。',
     'options': {'tone': 'concise', 'length': 'short', 'layout': 'para'}},
    {'id': 'collector', 'name': '收藏交流', 'instructions': '像唱片收藏者自然交流，完整保留已知版本信息，不编造评价与发行背景。',
     'options': {'tone': 'collector', 'length': 'long', 'layout': 'para'}},
    {'id': 'detailed', 'name': '详细说明', 'instructions': '清楚分段列出版本、品相、附件和已知问题；不重复、不夸张。',
     'options': {'tone': 'concise', 'length': 'long', 'layout': 'sections'}},
)
# 自定义风格的选项值只用于界面回显，写作时用前端据此拼好的 instructions；这里仅做白名单与长度清洗。
STYLE_TEXT_KEYS = (('tone', 40), ('length', 40), ('layout', 40), ('title', 40), ('ending', 300), ('extra', 1000))
STYLE_FLAG_KEYS = ('tracks', 'condition', 'emoji')


def clean_style_options(value):
    if not isinstance(value, dict): return None
    out = {key: text(value.get(key, ''), limit) for key, limit in STYLE_TEXT_KEYS}
    for key in STYLE_FLAG_KEYS: out[key] = value.get(key) is True
    return out


def clean_preferences(value):
    if not isinstance(value, dict): raise ValidationError('文案偏好格式无效')
    revision = value.get('revision', 0)
    if type(revision) is not int or revision < 0: raise ValidationError('文案偏好版本无效')
    rows = value.get('customPresets', [])
    if not isinstance(rows, list) or len(rows) > 20: raise ValidationError('最多保存 20 个自定义预设')
    seen = {row['id'] for row in BUILTIN_PRESETS}
    custom = []
    for row in rows:
        if not isinstance(row, dict): raise ValidationError('自定义预设无效')
        ident, name = text(row.get('id'), 100), text(row.get('name'), 60)
        if not ident or not name or ident in seen: raise ValidationError('预设名称或编号无效')
        seen.add(ident)
        item = {'id': ident, 'name': name, 'instructions': text(row.get('instructions', ''), 6000)}
        options = clean_style_options(row.get('options'))
        if options is not None: item['options'] = options
        custom.append(item)
    default = text(value.get('defaultPreset', 'concise'), 100)
    if default not in seen: raise ValidationError('请选择有效的默认预设')
    return {'revision': revision, 'defaultPreset': default, 'customPresets': custom}


def select_preset(preferences, ident):
    rows = [*BUILTIN_PRESETS, *preferences['customPresets']]
    preset = next((row for row in rows if row['id'] == ident), None)
    if preset is None: raise ValidationError('文案预设已变更，请重新选择')
    return dict(preset)
