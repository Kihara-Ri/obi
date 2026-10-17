"""Digital entity contracts; pure validation, no network or import side effects."""
import json
from copy import deepcopy
import math
import re
import unicodedata
from urllib.parse import urlsplit

from .errors import ValidationError
from .packaging import PACKAGING_ROLES, clean_packaging

TWIN_KEY = 'digital-twins-v1'
SKILL_VERSION = 'album-digital-twin/3'
JOB_STATES = frozenset({'queued', 'running', 'needs_input', 'succeeded', 'failed', 'interrupted', 'cancelled', 'stale'})
ID = re.compile(r'^[0-9a-f]{32}$')
ASSET = re.compile(r'^(?:photo-[0-9]+|cover|caa-[0-9]+|discogs-[0-9]+-[0-9]+|preview-[0-9]+)\.(?:jpg|png|webp)$')
UUID = re.compile(r'^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$')


def clean_barcode(value):
    """Keep leading zeros and reject incomplete or invalid EAN/UPC readings."""
    if value in (None, ''): return ''
    if not isinstance(value, str): raise ValidationError('请填写条形码数字')
    value = re.sub(r'[\s-]', '', unicodedata.normalize('NFKC', value))
    if not re.fullmatch(r'(?:[0-9]{8}|[0-9]{12,14})', value):
        raise ValidationError('请填写完整的 8、12、13 或 14 位条形码数字')
    checksum = sum(int(n) * (3 if i % 2 == 0 else 1) for i, n in enumerate(reversed(value[:-1])))
    if (checksum + int(value[-1])) % 10: raise ValidationError('条形码校验位不正确，请检查数字或重拍清晰的背面照片')
    return value


def release_id(value):
    if not value: return ''
    if not isinstance(value, str): raise ValidationError('发行版本链接格式不正确')
    if UUID.fullmatch(value): return value
    match = re.fullmatch(r'https://musicbrainz\.org/release/([0-9a-f-]{36})(?:/cover-art)?/?', value.strip())
    if match and UUID.fullmatch(match[1]): return match[1]
    raise ValidationError('请填写 MusicBrainz 的发行版本链接')


def image_type(raw):
    if raw.startswith(b'\xff\xd8\xff'): return 'jpg', 'image/jpeg'
    if raw.startswith(b'\x89PNG\r\n\x1a\n'): return 'png', 'image/png'
    if raw.startswith(b'RIFF') and raw[8:12] == b'WEBP': return 'webp', 'image/webp'
    raise ValidationError('来源没有返回可用图片')


def clean_warp_rows(rows):
    """Validate a continuous, convex strip map in the untouched source image."""
    if not isinstance(rows, list) or not 2 <= len(rows) <= 17:
        raise ValidationError('贴图校正须有 2–17 行折线坐标')
    cleaned = []
    for row in rows:
        if (not isinstance(row, list) or len(row) != 4
                or any(type(n) not in (int, float) or not 0 <= n <= 1 or not math.isfinite(n) for n in row)
                or row[0] >= row[2]):
            raise ValidationError('贴图校正坐标须在原图内，左右边界不能交叉')
        cleaned.append(list(row))
    cross = lambda a, b, c: (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
    for top, bottom in zip(cleaned, cleaned[1:]):
        if top[1] >= bottom[1] or top[3] >= bottom[3]:
            raise ValidationError('贴图校正折线须从上到下连续排列')
        quad = (top[:2], top[2:], bottom[2:], bottom[:2])
        if any(cross(quad[n], quad[(n + 1) % 4], quad[(n + 2) % 4]) <= 1e-12 for n in range(4)):
            raise ValidationError('贴图校正条带不能自交、折返或退化')
    return cleaned


def clean_spine_geometry(spine, package):
    """Physical/image calibration independent of any host asset naming scheme."""
    if package.get('structure') not in ('gatefold', 'digipak', 'digibook'):
        raise ValidationError('书脊校准仅适用于连续折脊的纸包装')
    if not isinstance(spine, dict): raise ValidationError('数字实体校准资料无效')
    ratio = spine.get('widthRatio')
    if type(ratio) not in (int, float) or not .001 <= ratio <= .2 or not math.isfinite(ratio) or spine.get('basis') != 'image-estimate':
        raise ValidationError('书脊须使用已获取图片的比例估算，不能作为实测尺寸')
    result = {'widthRatio':ratio, 'basis':'image-estimate'}
    if 'reliefMm' in spine:
        relief = spine['reliefMm']
        if (not isinstance(relief, list) or not 3 <= len(relief) <= 17
                or any(type(n) not in (int, float) or not -.15 <= n <= .15 or not math.isfinite(n) for n in relief)):
            raise ValidationError('书脊起伏近似须有 3–17 个值，且不超过 ±0.15 mm')
        result['reliefMm'] = list(relief)
    return result


def clean_spine_calibration(value, sources, package):
    if not isinstance(value, dict) or set(value) - {'spine'} or not isinstance(value.get('spine'), dict):
        raise ValidationError('数字实体校准资料无效')
    spine = value['spine']; result = clean_spine_geometry(spine, package)
    source_id = spine.get('sourceId')
    if not isinstance(source_id, str) or source_id not in sources:
        raise ValidationError('书脊须使用已获取图片的比例估算，不能作为实测尺寸')
    source = sources[source_id]
    if not ASSET.fullmatch(str(source.get('asset', ''))): raise ValidationError('书脊校准来源文件名无效')
    return {'spine':result | {'asset':source['asset'], 'sourceUrl':source.get('sourceUrl',''),
                             'origin':source.get('origin','record-photo'),
                             **({'sourceReleaseId':source['sourceReleaseId']} if source.get('origin') == 'compatible-edition-reference' and UUID.fullmatch(str(source.get('sourceReleaseId',''))) else {})}}


def clean_disc_calibration(value):
    """Presentation-only disc rim alignment, never a modification of source artwork."""
    if not isinstance(value, dict) or set(value) - {'outer', 'inner', 'source', 'confidence'} or value.get('source') not in ('auto', 'manual'):
        raise ValidationError('盘面校准资料格式不正确')
    def ellipse(e):
        if not isinstance(e, dict) or set(e) != {'cx', 'cy', 'rx', 'ry', 'angle'}:
            raise ValidationError('盘面椭圆参数不完整')
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in e.values()):
            raise ValidationError('盘面坐标必须是有限数')
        cx, cy, rx, ry, angle = (e[k] for k in ('cx','cy','rx','ry','angle'))
        if not (0 <= cx <= 1 and 0 <= cy <= 1 and .025 <= rx <= 1 and .025 <= ry <= 1
                and -math.pi <= angle <= math.pi and .18 <= rx / ry <= 5.5):
            raise ValidationError('盘面椭圆尺寸不合法')
        width = math.hypot(rx * math.cos(angle), ry * math.sin(angle))
        height = math.hypot(rx * math.sin(angle), ry * math.cos(angle))
        if cx - width < -.015 or cx + width > 1.015 or cy - height < -.015 or cy + height > 1.015:
            raise ValidationError('盘面椭圆超出照片边界')
        return {k: e[k] for k in ('cx', 'cy', 'rx', 'ry', 'angle')}
    outer = ellipse(value.get('outer'))
    inner = ellipse(value['inner']) if value.get('inner') is not None else None
    if inner is not None:
        if (inner['rx'] >= outer['rx'] * .85 or inner['ry'] >= outer['ry'] * .85
                or math.hypot(inner['cx']-outer['cx'], inner['cy']-outer['cy']) > max(outer['rx'], outer['ry']) * .4):
            raise ValidationError('盘面中心环须位于外圈内部')
    confidence = value.get('confidence')
    if confidence is not None and (type(confidence) not in (int,float) or not math.isfinite(confidence) or not 0 <= confidence <= 1):
        raise ValidationError('盘面校准置信度不合法')
    return {'outer': outer, **({'inner': inner} if inner else {}),
            'source': value['source'], **({'confidence': confidence} if confidence is not None else {})}


ACCESSORY_KINDS = frozenset(('obi', 'booklet', 'inner-sleeve'))


def clean_accessory_selection(entry, allowed, default_id=None):
    """Validate portable selections before image I/O; never infer fold or verso."""
    if (not isinstance(entry, dict) or not {'kind','sourceId'} <= set(entry)
            or set(entry) - {'id','kind','sourceId','region','back','fold'}):
        raise ValidationError('独立附件格式无效')
    ident, kind, source_id = entry.get('id', default_id), entry['kind'], entry['sourceId']
    if not isinstance(kind, str) or kind not in ACCESSORY_KINDS or not isinstance(ident, str) or not re.fullmatch(r'[a-z][a-z0-9-]{0,39}', ident):
        raise ValidationError('附件种类或标识无效')
    if not isinstance(source_id, str) or source_id not in allowed:
        raise ValidationError('附件图片必须来自已确认的图集')
    result = {'id':ident, 'kind':kind, 'sourceId':source_id}
    if entry.get('region') is not None:
        clean_packaging({'photoRegions': {'front': entry['region']}})
        result['region'] = deepcopy(entry['region'])
    if 'fold' in entry:
        if kind != 'booklet': raise ValidationError('只有歌词册可以声明折页')
        from .schema_validation import document_schema, validate_schema
        schema = document_schema()
        validate_schema(entry['fold'], {'$ref':'#/$defs/paper-fold', '$defs':schema['$defs']})
        result['fold'] = deepcopy(entry['fold'])
    if 'back' in entry:
        back = entry['back']
        if not isinstance(back, dict) or 'sourceId' not in back or set(back) - {'sourceId','region'}:
            raise ValidationError('附件背面格式无效')
        side = clean_accessory_selection({'id':ident, 'kind':kind, **back}, allowed)
        result['back'] = {k:v for k,v in side.items() if k not in ('id','kind')}
    return result


def clean_accessories(value, sources):
    """Each physical insert owns its own source and cannot masquerade as a fold surface."""
    if value is None: return []
    if not isinstance(value, list) or len(value) > 8:
        raise ValidationError('数字实体最多支持 8 个独立附件')
    cleaned = []
    for raw_entry in value:
        entry = clean_accessory_selection(raw_entry, sources)
        kind, ident, source_id = (entry[k] for k in ('kind','id','sourceId'))
        if any(other['id'] == ident for other in cleaned):
            raise ValidationError('附件编号不能重复')
        source = sources[source_id]
        if not ASSET.fullmatch(str(source.get('asset', ''))): raise ValidationError('附件图片名称无效')
        region = entry.get('region')
        cleaned.append({'id': ident, 'kind': kind, 'asset': source['asset'],
                        **({'region': region} if region is not None else {}),
                        'origin': source.get('origin', 'record-photo'), 'sourceUrl': source.get('sourceUrl', ''),
                        **({'sourceReleaseId': source['sourceReleaseId']} if source.get('origin') == 'compatible-edition-reference' and
                           UUID.fullmatch(str(source.get('sourceReleaseId',''))) else {})})
        if 'fold' in entry: cleaned[-1]['fold'] = dict(entry['fold'])
        if 'back' in entry:
            back = entry['back']
            # Reuse the same source/region/provenance contract for both faces.
            side = clean_accessories([{'id': ident, 'kind': kind, **back}], sources)[0]
            cleaned[-1]['back'] = {k:v for k,v in side.items() if k not in ('id','kind')}
    return cleaned


def entity_assets(entity):
    """Include calibration evidence even when it is not used as a surface texture."""
    assets = {source['asset'] for source in entity.get('surfaces', {}).values()}
    assets.update(part['asset'] for part in entity.get('components', []))
    assets.update(part['back']['asset'] for part in entity.get('components', []) if part.get('back'))
    spine = entity.get('calibration', {}).get('spine')
    if spine: assets.add(spine['asset'])
    return assets


def clean_presentation(value):
    """Validate authored initial camera data without any scene implementation."""
    from .schema_validation import document_schema, validate_schema
    schema = document_schema()
    validate_schema(value, {'$defs': schema['$defs'], **schema['$defs']['presentation']})
    return deepcopy(value)


def clean_entity(value, sources):
    if not isinstance(value, dict) or value.get('sameAlbum') is not True:
        raise ValidationError('素材与当前专辑无法确认一致，请核对发行版本')
    if not isinstance(value.get('packaging'), dict): raise ValidationError('agent 未确认包装结构')
    package = clean_packaging(value['packaging'])
    if not package or package.get('structure') in (None, 'unknown'): raise ValidationError('无法确认包装结构，请补充实物照片')
    # Surface references belong to this task, rather than mutable ledger photo indices.
    if 'photos' in package or 'photoRegions' in package:
        raise ValidationError('agent 应通过 surfaces 引用贴图')
    surfaces = value.get('surfaces')
    if not isinstance(surfaces, dict) or set(surfaces) - set(PACKAGING_ROLES): raise ValidationError('agent 贴图角色无效')
    cleaned = {}
    for role, entry in surfaces.items():
        if (not isinstance(entry, dict) or not isinstance(entry.get('sourceId'), str)
                or entry['sourceId'] not in sources): raise ValidationError('agent 引用了未获取的图片')
        source = sources[entry['sourceId']]
        if not ASSET.fullmatch(source['asset']): raise ValidationError('贴图文件名无效')
        region = entry.get('region')
        if region is not None:
            clean_packaging({'photoRegions': {role: region}})
        cleaned[role] = {'asset': source['asset'], 'region': region, 'sourceUrl': source.get('sourceUrl', ''),
                         'origin': source.get('origin', 'record-photo'),
                         **({'sourceReleaseId': source['sourceReleaseId']}
                            if source.get('origin') == 'compatible-edition-reference'
                            and isinstance(source.get('sourceReleaseId'), str)
                            and UUID.fullmatch(source['sourceReleaseId']) else {})}
        if 'warpRows' in entry: cleaned[role]['warpRows'] = clean_warp_rows(entry['warpRows'])
        if 'discCalibration' in entry:
            if not role.startswith('disc'): raise ValidationError('只有盘面允许使用椭圆校准')
            cleaned[role]['discCalibration'] = clean_disc_calibration(entry['discCalibration'])
    required = {'front', 'back'}
    kind = package['structure']
    if kind in ('jewel', 'gatefold', 'digipak', 'digibook'):
        required.add('insideLeft')
    if kind in ('gatefold', 'digipak', 'digibook'): required.add('insideRight')
    if kind in ('gatefold', 'digipak') and package.get('panels', 2) >= 3: required.add('insideCenter')
    if kind in ('gatefold', 'digipak') and package.get('panels', 2) >= 4: required.add('insideExtra')
    if package.get('slipcase'): required.add('outer')
    discs = package.get('discs', 1)
    required |= {'disc' if n == 0 else 'disc' + str(n + 1) for n in range(discs)}
    missing = sorted(required - set(cleaned))
    if missing: raise ValidationError('还缺少贴图：' + '、'.join(missing) + '。请补充照片后重试')
    warnings = value.get('warnings', [])
    if not isinstance(warnings, list) or any(not isinstance(w, str) or len(w) > 1000 for w in warnings):
        raise ValidationError('agent 的核对说明无效')
    result = {'packaging': package, 'surfaces': cleaned, 'warnings': warnings[:20]}
    if value.get('components'): result['components'] = clean_accessories(value['components'], sources)
    if 'calibration' in value: result['calibration'] = clean_spine_calibration(value['calibration'], sources, package)
    if 'presentation' in value: result['presentation'] = clean_presentation(value['presentation'])
    return result


def clean_registry(value):
    if not isinstance(value, dict) or not ID.fullmatch(str(value.get('epoch', ''))): raise ValidationError('数字实体任务备份无效')
    if type(value.get('revision')) is not int or value['revision'] < 0: raise ValidationError('数字实体任务版本无效')
    if not isinstance(value.get('jobs'), dict) or not isinstance(value.get('latest'), dict): raise ValidationError('数字实体任务清单无效')
    for ident, job in value['jobs'].items():
        if (not ID.fullmatch(ident) or not isinstance(job, dict) or job.get('id') != ident
                or not ID.fullmatch(str(job.get('recordId', ''))) or job.get('status') not in JOB_STATES
                or not ID.fullmatch(str(job.get('requestId', '')))
                or type(job.get('seq')) is not int or not isinstance(job.get('input'), dict)):
            raise ValidationError('数字实体任务内容无效')
        for asset in job.get('sources', {}).values():
            if not isinstance(asset, dict) or not ASSET.fullmatch(str(asset.get('asset', ''))): raise ValidationError('数字实体贴图索引无效')
        if job.get('entity'):
            validate_envelope(job['entity'])
    for rid, ident in value['latest'].items():
        if not ID.fullmatch(rid) or ident not in value['jobs'] or value['jobs'][ident]['recordId'] != rid:
            raise ValidationError('数字实体副本关联无效')
    return value


def validate_envelope(entity):
    """Validate a stored envelope without rewriting historical v1 entities."""
    if not isinstance(entity, dict) or not isinstance(entity.get('surfaces'), dict) or any(not isinstance(s, dict) for s in entity['surfaces'].values()):
        raise ValidationError('数字实体结果备份无效')
    if any('back' in part and not isinstance(part['back'], dict) for part in entity.get('components', [])):
        raise ValidationError('附件背面备份无效')
    candidate = {'sameAlbum': True, 'packaging': entity.get('packaging'),
                 **({'components': [{'id': c['id'], 'kind': c['kind'], 'sourceId': c['asset'],
                                            **({'fold': c['fold']} if 'fold' in c else {}),
                                            **({'back': {'sourceId': c['back']['asset'],
                                                         **({'region': c['back']['region']} if 'region' in c['back'] else {})}} if c.get('back') else {}),
                                            **({'region': c['region']} if 'region' in c else {})}
                                        for c in entity['components']]} if entity.get('components') else {}),
                 'surfaces': {r: {'sourceId': r, 'region': s.get('region'),
                                 **({'warpRows': s['warpRows']} if 'warpRows' in s else {}),
                                 **({'discCalibration': s['discCalibration']} if 'discCalibration' in s else {})}
                              for r, s in entity.get('surfaces', {}).items()},
                 'warnings': entity.get('warnings', [])}
    sources = dict(entity['surfaces'])
    sources.update({c['asset']: c for c in entity.get('components', [])})
    sources.update({c['back']['asset']: c['back'] for c in entity.get('components', []) if c.get('back')})
    if 'calibration' in entity:
        calibration = entity['calibration']
        if not isinstance(calibration, dict) or set(calibration) != {'spine'} or not isinstance(calibration['spine'], dict):
            raise ValidationError('数字实体校准备份无效')
        spine = calibration['spine']; sources['calibration:spine'] = spine
        candidate['calibration'] = {'spine': {**spine, 'sourceId': 'calibration:spine'}}
    if 'presentation' in entity: candidate['presentation'] = entity['presentation']
    clean_entity(candidate, sources)
    if 'document' in entity:
        from .document import validate_document, compile_document
        document = validate_document(entity['document'])
        if compile_document(entity, document['key'], document['title']) != document:
            raise ValidationError('实体文档与来源装配不一致')
    return entity




def clean_spine_binding(source_role, region):
    """Validate an original-image printed edge without changing source pixels."""
    if region is None: return None
    if source_role not in ('front', 'back'):
        raise ValidationError('书脊只能从当前实体已验证的正面或背面图源裁取')
    normalized = clean_packaging({'photoRegions': {'spine': region}})['photoRegions']['spine']
    width = max(normalized[0::2]) - min(normalized[0::2])
    height = max(normalized[1::2]) - min(normalized[1::2])
    if (not (.003 <= width <= .09 and height >= .65)
            or normalized[0] >= normalized[2] or normalized[6] >= normalized[4]
            or normalized[1] >= normalized[7] or normalized[3] >= normalized[5]
            or abs(normalized[1] - normalized[3]) > .05
            or abs(normalized[5] - normalized[7]) > .05):
        raise ValidationError('书脊必须是原图中自上而下的狭长连续印刷边')
    return normalized
