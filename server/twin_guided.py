"""Deterministic and human-confirmed art binding. Never runs a visual model."""
from domain import ValidationError
from server.artwork_fallback import packaging_family
from server.twin_errors import NeedsInput
from server.twin_assembly import GeometryAssembly

ROLES = ('front', 'back', 'insideLeft', 'insideRight', 'insideCenter', 'insideExtra',
         'disc', 'disc2', 'disc3', 'disc4', 'outer', 'spine')
KINDS = ('obi', 'booklet', 'inner-sleeve')


def candidate_images(catalog):
    result = []
    for image in catalog.get('images', [])[:40]:
        if isinstance(image, dict) and str(image.get('id', '')).isdigit():
            result.append({'sourceId': 'caa:' + str(image['id']), 'types': image.get('types', [])})
    for reference in catalog.get('editionReferences', []):
        if reference.get('status') == 'verified':
            result.extend({'sourceId': image['sourceId'], 'types': []}
                          for image in reference.get('images', [])[:40])
    for reference in catalog.get('compatibleArtwork', [])[:2]:
        result.extend({'sourceId': image['sourceId'], 'types': image.get('types', [])}
                      for image in reference.get('images', [])[:40])
    return result


def suggested_surfaces(catalog, discs):
    """Only explicitly tagged CAA roles; Discogs secondary photos are unclassified."""
    labels = {'front': 'front', 'back': 'back', 'medium': 'disc',
              'spine': 'spine', 'inside': 'insideLeft'}
    found = {}
    for item in candidate_images(catalog):
        for role in item['types']:
            target = labels.get(str(role).casefold())
            if target and target not in found:
                found[target] = item['sourceId']
    return found


def validated_mapping(mapping, allowed, disc_count, release=None):
    if not isinstance(mapping, dict) or not isinstance(mapping.get('packaging'), dict):
        raise ValidationError('请先选择有证据支持的包装结构')
    surfaces = mapping.get('surfaces')
    if not isinstance(surfaces, dict) or not surfaces or set(surfaces) - set(ROLES):
        raise ValidationError('贴图角色无效')
    if not isinstance(allowed, (set, frozenset)): allowed = set(allowed)
    if any(not isinstance(source, str) or source not in allowed for source in surfaces.values()):
        raise ValidationError('选用了未经核验的图源')
    raw_components = mapping.get('components', [])
    if not isinstance(raw_components, list) or len(raw_components) > 8:
        raise ValidationError('最多支持八个独立附件')
    components = []
    for index, comp in enumerate(raw_components):
        if not isinstance(comp, dict) or comp.get('kind') not in KINDS or comp.get('sourceId') not in allowed:
            raise ValidationError('附件必须选择已验证的原始图片')
        components.append({'id': f'{comp["kind"]}-{index + 1}', 'kind': comp['kind'], 'sourceId': comp['sourceId']})
    expected = packaging_family((release or {}).get('packaging'))
    if expected == 'box': expected = 'rigid-box'
    chosen = mapping['packaging'].get('structure')
    override = mapping.get('confirmedPackagingOverride') is True
    if expected and chosen != expected and not override:
        raise ValidationError('封装与发行资料不一致，请核对实物并确认覆盖')
    if mapping['packaging'].get('discs', disc_count) != disc_count:
        raise ValidationError('已确认的发行版碟数不能被选图改变')
    ids = list(dict.fromkeys(list(surfaces.values()) + [c['sourceId'] for c in components]))
    if not 1 <= len(ids) <= 16: raise ValidationError('一次最多可使用 16 张素材')
    return {'packaging': dict(mapping['packaging']), 'surfaces': dict(surfaces), 'components': components,
            'confirmedPackagingOverride': override}, ids


def generate_guided(discovery, job, step):
    release = job['confirmedRelease']
    count = sum('CD' in str(m.get('format', '')) for m in release.get('media', []))
    if not 1 <= count <= 4: raise NeedsInput('只支持 1–4 张 CD 的发行版本')
    assembly = GeometryAssembly(discovery.store)
    manifest = discovery.prepare(job, release, step, assembly.own_faces_complete(job, count))
    manual = job.get('guidedSelection')
    plan, ids = validated_mapping(manual, manifest.allowed_ids, count, release)
    sources, _ = discovery.fetch_images(job, manifest, ids, step)
    result = {'sameAlbum': True, 'packaging': plan['packaging'],
              'surfaces': {role: {'sourceId': sid} for role, sid in plan['surfaces'].items()},
              'components': plan['components'],
              'warnings': ['此数字实体由已核验原图和人工确认的结构组装，未使用视觉生成模型；未有实物测量的尺寸为模板参考比例。'] +
                  (['实物封装已被人工确认与 MusicBrainz 发行资料不同，请对照已保存的实物照片。']
                   if plan['confirmedPackagingOverride'] else [])}
    entity = assembly.assemble(result, job, release, sources, count)
    return entity
