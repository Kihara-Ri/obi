"""Digital entity contracts; pure validation, no network or import side effects."""
import json
import math
import re
import unicodedata
from urllib.parse import urlsplit

from domain import ValidationError, PACKAGING_ROLES, clean_packaging

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


def appearance(record):
    keys = ('title', 'artist', 'version', 'pressing', 'obi', 'packaging', 'cover', 'photoCount', 'photoRevision')
    result = {key: record.get(key) for key in keys}
    result['releaseInfo'] = {key: record.get('releaseInfo', {}).get(key, '') for key in
                            ('barcode', 'catalogNumber', 'country', 'edition', 'label', 'releaseDate', 'discCount', 'format', 'matrix', 'musicBrainzReleaseId')}
    return result


def same_appearance(record, snapshot):
    return appearance(record) == snapshot


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


def clean_spine_calibration(value, sources, package):
    if not isinstance(value, dict) or set(value) - {'spine'} or not isinstance(value.get('spine'), dict):
        raise ValidationError('数字实体校准资料无效')
    if package.get('structure') not in ('gatefold', 'digipak', 'digibook'):
        raise ValidationError('书脊校准仅适用于连续折脊的纸包装')
    spine = value['spine']; ratio = spine.get('widthRatio'); source_id = spine.get('sourceId')
    if (type(ratio) not in (int, float) or not .001 <= ratio <= .2 or not math.isfinite(ratio)
            or spine.get('basis') != 'image-estimate' or not isinstance(source_id, str) or source_id not in sources):
        raise ValidationError('书脊须使用已获取图片的比例估算，不能作为实测尺寸')
    source = sources[source_id]
    if not ASSET.fullmatch(str(source.get('asset', ''))): raise ValidationError('书脊校准来源文件名无效')
    result = {'widthRatio': ratio, 'basis': 'image-estimate', 'asset': source['asset'],
              'sourceUrl': source.get('sourceUrl', ''), 'origin': source.get('origin', 'record-photo')}
    if 'reliefMm' in spine:
        relief = spine['reliefMm']
        if (not isinstance(relief, list) or not 3 <= len(relief) <= 17
                or any(type(n) not in (int, float) or not -.15 <= n <= .15 or not math.isfinite(n) for n in relief)):
            raise ValidationError('书脊起伏近似须有 3–17 个值，且不超过 ±0.15 mm')
        result['reliefMm'] = list(relief)
    return {'spine': result}


def entity_assets(entity):
    """Include calibration evidence even when it is not used as a surface texture."""
    assets = {source['asset'] for source in entity.get('surfaces', {}).values()}
    spine = entity.get('calibration', {}).get('spine')
    if spine: assets.add(spine['asset'])
    return assets


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
                         'origin': source.get('origin', 'record-photo')}
        if 'warpRows' in entry: cleaned[role]['warpRows'] = clean_warp_rows(entry['warpRows'])
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
    if 'calibration' in value: result['calibration'] = clean_spine_calibration(value['calibration'], sources, package)
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
            entity = job['entity']
            if not isinstance(entity, dict) or not isinstance(entity.get('surfaces'), dict) or any(not isinstance(s, dict) for s in entity['surfaces'].values()):
                raise ValidationError('数字实体结果备份无效')
            candidate = {'sameAlbum': True, 'packaging': entity.get('packaging'),
                         'surfaces': {r: {'sourceId': r, 'region': s.get('region'),
                                         **({'warpRows': s['warpRows']} if 'warpRows' in s else {})}
                                      for r, s in entity.get('surfaces', {}).items()},
                         'warnings': entity.get('warnings', [])}
            sources = dict(entity['surfaces'])
            if 'calibration' in entity:
                calibration = entity['calibration']
                if not isinstance(calibration, dict) or set(calibration) != {'spine'} or not isinstance(calibration['spine'], dict):
                    raise ValidationError('数字实体校准备份无效')
                spine = calibration['spine']; sources['calibration:spine'] = spine
                candidate['calibration'] = {'spine': {**spine, 'sourceId': 'calibration:spine'}}
            clean_entity(candidate, sources)
    for rid, ident in value['latest'].items():
        if not ID.fullmatch(rid) or ident not in value['jobs'] or value['jobs'][ident]['recordId'] != rid:
            raise ValidationError('数字实体副本关联无效')
    return value
