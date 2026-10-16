"""Independent physical packaging validation, shared by all runtime stages."""
import math
from .errors import ValidationError

PACKAGING_ROLES = ('front', 'back', 'spine', 'insideSpine', 'insideLeft', 'insideRight', 'insideCenter', 'insideExtra', 'disc', 'disc2', 'disc3', 'disc4', 'outer')


def clean_packaging(value):
    """Optional physical-copy metadata; legacy version text remains independent."""
    if value is None: return {}
    if not isinstance(value, dict): raise ValidationError('包装资料格式不正确')
    enums = {
        'structure': ('jewel', 'card-sleeve', 'gatefold', 'digipak', 'digibook', 'rigid-box', 'unknown'),
        'thickness': ('slim', 'standard', 'thick'), 'pockets': ('left', 'right', 'both'),
        'pocketOpening': ('outer', 'inner'),
        'holder': ('tray', 'pocket'), 'tray': ('clear', 'black', 'white'),
        'finish': ('uncoated', 'matte', 'gloss'),
    }
    allowed = set(enums) | {'panels', 'discs', 'miniLP', 'slipcase', 'size', 'photos', 'photoRegions'}
    if set(value) - allowed: raise ValidationError('包装资料包含未知字段')
    result = {}
    for key, choices in enums.items():
        if key in value:
            if value[key] not in choices: raise ValidationError('包装选项无效：' + key)
            result[key] = value[key]
    for key, choices in (('panels', (2, 3, 4)), ('discs', (1, 2, 3, 4))):
        if key in value:
            if type(value[key]) is not int or value[key] not in choices: raise ValidationError('包装数量无效：' + key)
            result[key] = value[key]
    for key in ('miniLP', 'slipcase'):
        if key in value:
            if type(value[key]) is not bool: raise ValidationError('包装标记无效：' + key)
            result[key] = value[key]
    if 'size' in value:
        size = value['size']
        if not isinstance(size, dict) or set(size) != {'width', 'height', 'depth'}: raise ValidationError('请提供完整的包装宽、高、厚度')
        for key, minimum, maximum in (('width', 50, 500), ('height', 50, 700), ('depth', .1, 300)):
            n = size[key]
            if type(n) not in (int, float) or not minimum <= n <= maximum or not math.isfinite(n):
                raise ValidationError('包装尺寸无效：' + key)
        result['size'] = dict(size)
    if 'photos' in value:
        photos = value['photos']
        if not isinstance(photos, dict) or set(photos) - set(PACKAGING_ROLES): raise ValidationError('包装贴图位置无效')
        if any(type(n) is not int or not 0 <= n < 30 for n in photos.values()): raise ValidationError('包装贴图照片序号无效')
        result['photos'] = dict(photos)
    if 'photoRegions' in value:
        regions = value['photoRegions']
        if not isinstance(regions, dict) or set(regions) - set(PACKAGING_ROLES):
            raise ValidationError('包装贴图区域位置无效')
        normalized = {}
        for role, region in regions.items():
            if not isinstance(region, list) or len(region) != 8 or any(
                    type(n) not in (int, float) or not 0 <= n <= 1 or not math.isfinite(n) for n in region):
                raise ValidationError('包装贴图区域坐标无效：' + role)
            points = list(zip(region[::2], region[1::2]))
            turns = []
            for i, (x, y) in enumerate(points):
                nx, ny = points[(i + 1) % 4]
                fx, fy = points[(i + 2) % 4]
                turns.append((nx - x) * (fy - ny) - (ny - y) * (fx - nx))
            if not (all(n > 1e-8 for n in turns) or all(n < -1e-8 for n in turns)):
                raise ValidationError('包装贴图区域须为有序凸四边形：' + role)
            normalized[role] = list(region)
        result['photoRegions'] = normalized
    return result
