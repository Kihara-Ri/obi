"""Compile verified package, print surfaces and attachment topology.

The legacy wire envelope remains available while document is the canonical v2
assembly used by viewers and publication validation.
"""
from .errors import ValidationError
from copy import deepcopy
from .contracts import clean_entity, clean_warp_rows, SKILL_VERSION
from .errors import NeedsInput

def rows_match_manual_region(rows, region):
    """Rows are original coordinates; an explicit manual quad owns its boundary."""
    boundary = rows[0] + rows[-1][2:] + rows[-1][:2]
    if any(abs(a - b) > 1e-8 for a, b in zip(boundary, region)): return False
    points = list(zip(region[::2], region[1::2]))
    for row in rows:
        for point in (row[:2], row[2:]):
            turns = [(b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0])
                     for a, b in zip(points, points[1:] + points[:1])]
            if not (all(turn >= -1e-8 for turn in turns) or all(turn <= 1e-8 for turn in turns)): return False
    return True


class GeometryAssembly:
    def __init__(self, store):
        self.store = store

    def own_faces_complete(self, job, cd_count):
        manual = job['input'].get('packaging') or {}
        surfaces = {role: {'sourceId': 'photo:' + str(index), 'region': manual.get('photoRegions', {}).get(role)}
                    for role, index in manual.get('photos', {}).items()}
        package = {key: value for key, value in manual.items() if key not in ('photos', 'photoRegions')}
        package['discs'] = manual.get('discs', cd_count)
        try:
            entity = clean_entity({'sameAlbum': True, 'packaging': package, 'surfaces': surfaces}, job['sources'])
            return all(self.store.twin_source(job['id'], entry['asset']).is_file() for entry in entity['surfaces'].values())
        except (ValidationError, OSError): return False

    def assemble(self, result, job, release, sources, cd_count):
        record = job['input']
        edition = job['releaseId']
        manual = record.get('packaging') or {}
        # BUILD output belongs to the interpreter; do not mutate cross-stage input.
        result = deepcopy(result)
        package = result.get('packaging')
        if not isinstance(package, dict): raise ValidationError('agent 未返回包装资料')
        package = {**package, **{k: v for k, v in manual.items() if k not in ('photos', 'photoRegions') and v != 'unknown'}}
        if 'size' not in manual: package.pop('size', None)  # 图像比例不能伪装成实测毫米
        package['discs'] = manual.get('discs', cd_count)
        result['packaging'] = package
        surfaces = result.get('surfaces', {})
        manual_warnings = []
        try:
            for role, index in manual.get('photos', {}).items():
                source_id = 'photo:' + str(index); planned = surfaces.get(role)
                region = manual.get('photoRegions', {}).get(role)
                entry = {'sourceId': source_id, 'region': region}
                if isinstance(planned, dict) and 'warpRows' in planned:
                    if planned.get('sourceId') == source_id:
                        rows = clean_warp_rows(planned['warpRows'])
                        if region is None or rows_match_manual_region(rows, region): entry['warpRows'] = rows
                        else: manual_warnings.append(f'{role} 使用手动贴图区域，未应用与其边界冲突的曲面校正')
                    else: manual_warnings.append(f'{role} 使用手动绑定照片，未应用其他原图的曲面校正')
                surfaces[role] = entry
            result['surfaces'] = surfaces
            entity = clean_entity(result, sources)
        except ValidationError as exc: raise NeedsInput(str(exc)) from None
        borrowed = sorted({surface.get('sourceReleaseId') for surface in entity['surfaces'].values()
                           if surface.get('origin') == 'compatible-edition-reference'})
        borrowed_warnings = ([f'部分印刷面借用同专辑、同封装的其他发行版 {rid}；'
                              '该参考不证明当前副本的印刷、侧标或附属品完全一致。'
                              for rid in borrowed] if borrowed else [])
        entity['warnings'] = (manual_warnings + borrowed_warnings + entity['warnings'])[:20]
        entity['release'] = {'id': edition, 'title': str(release.get('title', '')),
                             'url': 'https://musicbrainz.org/release/' + edition}
        entity['skill'] = SKILL_VERSION
        if 'size' not in manual: entity['warnings'].append('使用包装参考比例，未填写实测尺寸')
        from .document import prepare_publication
        return prepare_publication(entity, job.get('id', release['id']), str(record.get('title', release.get('title', ''))), context='generation')
