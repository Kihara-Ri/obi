"""Canonical assembly compiler and validator, using the rig's shared JSON contract.

Compilation is an explicit BUILD/publication operation. Reading a historical
legacy envelope never assigns attachment slots or rewrites persisted records.
"""
from copy import deepcopy
import json
from pathlib import Path
import re
from .errors import ValidationError
from .schema_validation import document_schema, validate_schema
from .packaging import clean_packaging, PACKAGING_ROLES
from .contracts import clean_warp_rows, clean_disc_calibration, clean_spine_geometry, clean_presentation


def model_contract():
    path = Path(__file__).with_name('model-set.json')
    if not path.is_file(): path = Path(__file__).resolve().parents[2] / 'src/contracts/model-set.json'
    return json.loads(path.read_text(encoding='utf-8'))


def model_stem(package, calibrated=False):
    kind = package.get('structure'); discs = package.get('discs', 1)
    thickness = package.get('thickness', 'standard'); holder = package.get('holder', 'tray' if kind in ('jewel','digipak') else 'pocket')
    if kind == 'jewel':
        return 'slimline-jewel' if thickness == 'slim' else 'jewel-fat' if thickness == 'thick' else 'jewel-swing-4' if discs > 2 else 'jewel-swing-2' if discs > 1 else 'jewel-case'
    if kind in ('gatefold', 'digipak'):
        if (kind == 'gatefold' and package.get('panels', 2) == 2 and package.get('miniLP')
                and holder == 'pocket' and package.get('pocketOpening', 'outer') == 'outer' and calibrated):
            return 'gatefold-2-mini-lp'
        return kind + '-' + str(package.get('panels', 2)) + ('-inner' if kind == 'gatefold' and holder == 'pocket' and package.get('pocketOpening') == 'inner' else '')
    return 'mini-lp-sleeve' if kind == 'card-sleeve' and package.get('miniLP') else kind


def panel_discs(package):
    kind = package['structure']; discs = package.get('discs', 1)
    holder = package.get('holder', 'tray' if kind in ('jewel','digipak') else 'pocket')
    if kind == 'jewel': return {0: list(range(discs))}
    if kind in ('card-sleeve', 'rigid-box'): return {1: list(range(discs))}
    if holder == 'pocket' and package.get('pockets', 'right') != 'both':
        return {0 if package.get('pockets') == 'left' else 1: list(range(discs))}
    if discs == 1: return {1: [0]}
    count = min(package.get('panels', 2), discs); before = 0; result = {}
    for panel in range(count):
        amount = discs // count + int(panel >= count - discs % count)
        result[panel] = list(range(before, before + amount)); before += amount
    return result


def _dimensions(values, basis='template', source=None):
    return dict(zip(('width', 'height', 'depth'), values)) | {'basis': basis} | ({'source': source} if source else {})


def compile_document(envelope, key, title):
    """Build a v2 entity from verified materials and explicit engine template slots."""
    if not isinstance(envelope, dict): raise ValidationError('数字实体结果无效')
    package = clean_packaging(envelope.get('packaging'))
    if not package or 'photos' in package or 'photoRegions' in package: raise ValidationError('实体配置不能引用可变照片序号')
    contract = model_contract(); stem = model_stem(package, bool(envelope.get('calibration')))
    model = contract['models'].get(stem)
    if model is None: raise ValidationError('引擎暂不支持这种包装')
    root = {'id':'package', 'kind':'package', 'definition':stem, 'parent':None, 'mount':None,
            'configuration':deepcopy(package),
            'dimensions':_dimensions([package['size'][n] for n in ('width','height','depth')], 'measured', 'manual') if 'size' in package else _dimensions(model['nominal_mm']),
            'surfaces':deepcopy(envelope.get('surfaces', {}))}
    components = [root]; holders = {}; disc_components = {}
    holder_kind = package.get('holder', 'tray' if package['structure'] in ('jewel','digipak') else 'pocket')
    if package['structure'] in ('card-sleeve','rigid-box'): holder_kind = 'pocket'
    for panel, indices in panel_discs(package).items():
        mount = holder_kind + ':' + str(panel); socket = model['sockets'].get(mount)
        if socket is None: raise ValidationError('包装缺少光盘固定槽')
        ident = holder_kind + '-' + str(panel); holders[panel] = ident
        components.append({'id':ident,'kind':holder_kind,'definition':holder_kind,'parent':'package','mount':mount,
                           'dimensions':_dimensions(socket['size_mm']),'surfaces':{}})
        for index in indices:
            role = 'disc' + (str(index + 1) if index else '')
            disc = {'id':'disc-' + str(index + 1),'kind':'disc','definition':'cd','parent':ident,'mount':'disc:' + str(index),
                    'dimensions':_dimensions([120,120,1.2]),'surfaces':{'front':deepcopy(root['surfaces'][role])} if role in root['surfaces'] else {}}
            components.append(disc); disc_components[index] = disc
    occupied = set(); sleeves = [panel for panel in reversed(list(holders)) if holder_kind == 'pocket' and 'sleeve:panel:' + str(panel) in model['sockets']]
    old_parts = {c['id']: c for c in envelope.get('document', {}).get('assembly', {}).get('components', []) if isinstance(c, dict) and isinstance(c.get('id'), str)}
    for part in envelope.get('components', []):
        kind = part.get('kind'); ident = part.get('id'); previous = old_parts.get(ident, {})
        mount = part.get('mount') or (previous.get('mount') if previous.get('kind') == kind else None)
        if not mount:
            if kind == 'obi': mount = 'obi:spine'
            elif kind == 'booklet': mount = 'booklet:panel:0'
            elif kind == 'inner-sleeve' and sleeves: mount = 'sleeve:panel:' + str(sleeves[0])
        socket = model['sockets'].get(mount)
        if not socket or socket['kind'] != kind or mount in occupied: raise ValidationError('附件没有唯一且兼容的挂载槽，请核对附件归属')
        occupied.add(mount)
        component = {'id':ident,'kind':kind,'definition':kind,'parent':'package','mount':mount,
                     'dimensions':_dimensions(socket['size_mm']),
                     'surfaces':{'front':{k:deepcopy(v) for k,v in part.items() if k not in ('id','kind','mount','parent','dimensions','contains','back','fold')},
                                 **({'back':deepcopy(part['back'])} if part.get('back') else {})}}
        if 'fold' in part: component['fold'] = deepcopy(part['fold'])
        if kind == 'obi':
            component['dimensions']['height'] = min(socket['size_mm'][1], root['dimensions']['height'] - 1.5)
            component['dimensions']['width'] = min(socket['size_mm'][0], root['dimensions']['width'] * .17)
        if kind == 'inner-sleeve':
            panel = socket['panel']
            if panel not in holders or holder_kind != 'pocket': raise ValidationError('内袋只能放入已占用的口袋')
            if panel in sleeves: sleeves.remove(panel)
            component['parent'] = holders[panel]
            component['contains'] = []
            # One paper inner sleeve contains one CD; other discs assigned to
            # this panel remain in the registered carrier.
            for index in panel_discs(package)[panel][:1]:
                disc_components[index]['parent'] = ident
                component['contains'].append(disc_components[index]['id'])
        components.append(component)
    assets = {}
    for comp in components:
        for surface in comp['surfaces'].values():
            if not isinstance(surface, dict) or not isinstance(surface.get('asset'), str): raise ValidationError('实体贴图缺少资产标识')
            asset = surface['asset']; provenance = {k: deepcopy(surface[k]) for k in ('origin','sourceUrl','sourceReleaseId') if k in surface}
            if asset in assets and assets[asset] != provenance: raise ValidationError('同一资产来源不一致')
            assets[asset] = provenance
    document = {'schemaVersion':2,'key':key,'title':title,'modelSet':contract['modelSet'],
                'assembly':{'root':'package','components':components},'assets':assets}
    if 'front' in root['surfaces']: document['preview'] = deepcopy(root['surfaces']['front'])
    if envelope.get('calibration'):
        document['calibration'] = deepcopy(envelope['calibration'])
        spine = document['calibration'].get('spine', {})
        if spine.get('asset'):
            provenance = {k:spine[k] for k in ('origin','sourceUrl','sourceReleaseId') if k in spine}
            existing = assets.get(spine['asset'], {})
            if any(k in existing and existing[k] != value for k,value in provenance.items()): raise ValidationError('校准与贴图来源不一致')
            assets[spine['asset']] = {**existing, **provenance}
    if 'presentation' in envelope:
        document['presentation'] = clean_presentation(envelope['presentation'])
    elif 'presentation' in envelope.get('document', {}):
        document['presentation'] = clean_presentation(envelope['document']['presentation'])
    return validate_document(document)


def _validate_surface(surface, assets):
    if surface['asset'] not in assets: raise ValidationError('实体引用了未声明资产')
    if surface.get('region') is not None: clean_packaging({'photoRegions':{'front':surface['region']}})
    if 'warpRows' in surface: clean_warp_rows(surface['warpRows'])
    if 'discCalibration' in surface: clean_disc_calibration(surface['discCalibration'])
    provenance = assets[surface['asset']]
    if any(k in surface and provenance.get(k) != surface[k] for k in ('origin','sourceUrl','sourceReleaseId')): raise ValidationError('实体资产来源不一致')


def _validate_document(document):
    """Physical invariants after canonical schema has established the structure."""
    contract = model_contract()
    if document['modelSet'] != contract['modelSet']: raise ValidationError('实体模型版本不支持')
    assets = document['assets']; components = document['assembly']['components']; by_id = {}
    for comp in components:
        ident = comp['id']
        if ident in by_id: raise ValidationError('实体组件标识重复')
        by_id[ident] = comp
        for surface in comp['surfaces'].values(): _validate_surface(surface, assets)
    root = by_id.get('package')
    if not root or root.get('kind') != 'package' or root.get('parent') is not None or root.get('mount') is not None: raise ValidationError('实体根包装无效')
    package = root['configuration']; model = contract['models'].get(root['definition'])
    if not model or root['definition'] != model_stem(package, bool(document.get('calibration'))): raise ValidationError('包装配置与模型不一致')
    if set(root['surfaces']) - set(PACKAGING_ROLES): raise ValidationError('包装印刷面角色无效')
    if 'contains' in root: raise ValidationError('包装不允许绕过固定槽持有光盘')
    expected_size = package.get('size')
    expected_dims = [expected_size[k] for k in ('width','height','depth')] if expected_size else model['nominal_mm']
    if any(abs(root['dimensions'][k] - v) > 1e-6 for k,v in zip(('width','height','depth'), expected_dims)) or root['dimensions']['basis'] != ('measured' if expected_size else 'template'): raise ValidationError('包装尺寸与来源不一致')
    mounts = set(); disc_indices = set(); expected_panels = panel_discs(package)
    holder_kind = package.get('holder', 'tray' if package['structure'] in ('jewel','digipak') else 'pocket')
    if package['structure'] in ('card-sleeve','rigid-box'): holder_kind = 'pocket'
    for comp in components:
        if comp is root: continue
        kind = comp.get('kind'); parent = by_id.get(comp.get('parent')); mount = comp.get('mount')
        if not parent: raise ValidationError('实体组件归属无效')
        if kind == 'booklet' and comp.get('fold') and comp['dimensions']['depth'] + .000001 < comp['fold']['panels'] * .1:
            raise ValidationError('折页厚度不足以容纳真实纸张')
        cursor = comp; seen = set()
        while cursor is not root:
            if cursor['id'] in seen: raise ValidationError('实体装配形成循环')
            seen.add(cursor['id']); cursor = by_id.get(cursor.get('parent'))
            if cursor is None: raise ValidationError('实体组件不属于根包装')
        if (parent['id'],mount) in mounts: raise ValidationError('实体挂载槽重复或无效')
        mounts.add((parent['id'],mount))
        if kind == 'disc':
            match = re.fullmatch(r'disc:([0-3])', mount)
            if comp.get('definition') != 'cd' or parent['kind'] not in ('pocket','tray','inner-sleeve') or not match: raise ValidationError('光盘缺少合法固定结构')
            index = int(match[1]); disc_indices.add(index)
            holder = by_id[parent['parent']] if parent['kind'] == 'inner-sleeve' else parent
            try: panel = int(holder['mount'].split(':')[-1])
            except (ValueError,KeyError): raise ValidationError('光盘固定结构无效') from None
            if parent['kind'] == 'inner-sleeve' and (parent['dimensions']['width'] < 121.3 or parent['dimensions']['height'] < 121.3 or parent['dimensions']['depth'] < 1.6): raise ValidationError('内袋没有容纳 CD 的空间')
            if index not in expected_panels.get(panel, []) or index >= package.get('discs',1): raise ValidationError('光盘与固定槽不一致')
            if any(abs(comp['dimensions'][k]-v)>1e-6 for k,v in zip(('width','height','depth'),(120,120,1.2))): raise ValidationError('CD 尺寸无效')
            if set(comp['surfaces']) - {'front'}: raise ValidationError('光盘印刷面无效')
        else:
            socket = model['sockets'].get(mount)
            if not socket or socket['kind'] != kind or comp.get('definition') != kind: raise ValidationError('模型没有兼容的附件挂载槽')
            if kind in ('tray','pocket'):
                if parent is not root or kind != holder_kind or socket.get('panel') not in expected_panels: raise ValidationError('固定结构与包装不一致')
            elif kind == 'inner-sleeve':
                if parent['kind'] != 'pocket' or parent.get('mount') != 'pocket:' + str(socket.get('panel')): raise ValidationError('内袋与口袋归属不一致')
            elif parent is not root: raise ValidationError('附件须挂在包装注册槽位')
            if kind == 'obi' and (comp['dimensions']['height'] > root['dimensions']['height'] or comp['dimensions']['width'] > root['dimensions']['width'] / 2): raise ValidationError('侧标尺寸超出包装')
            if kind == 'inner-sleeve' and any(comp['dimensions'][k] > parent['dimensions'][k] for k in ('width','height','depth')): raise ValidationError('内袋不能大于口袋')
            if kind in ('tray','pocket') and comp['surfaces']: raise ValidationError('固定结构不允许覆盖独立印刷面')
            if kind not in ('tray','pocket') and set(comp['surfaces']) - {'front','back'}: raise ValidationError('附件印刷面无效')
            if any(comp['dimensions'][k] > v + .001 for k,v in zip(('width','height','depth'),socket['size_mm'])): raise ValidationError('附件尺寸超出挂载槽')
        if kind == 'inner-sleeve' and 'contains' not in comp: raise ValidationError('内袋必须明确其光盘归属')
        if 'contains' in comp:
            if kind not in ('inner-sleeve','pocket','tray'): raise ValidationError('附件持有关系无效')
            if kind == 'inner-sleeve' and len(comp['contains']) != 1: raise ValidationError('一个内袋只能容纳一张 CD')
            actual = {c['id'] for c in components if c.get('parent') == comp['id'] and c.get('kind') == 'disc'}
            if set(comp['contains']) != actual: raise ValidationError('内袋光盘归属不一致')
    if disc_indices != set(range(package.get('discs',1))) or sum(c['kind']=='disc' for c in components) != len(disc_indices): raise ValidationError('光盘装配不完整或重复')
    if 'preview' in document: _validate_surface(document['preview'],assets)
    if 'calibration' in document:
        spine = document['calibration']['spine']
        if spine.get('asset') not in assets: raise ValidationError('校准证据资产缺失')
        if any(k in spine and assets[spine['asset']].get(k) != spine[k] for k in ('origin','sourceUrl','sourceReleaseId')): raise ValidationError('校准证据来源不一致')
        clean_spine_geometry(spine,package)
    return deepcopy(document)


def prepare_publication(envelope, key, title, *, context):
    """Compile explicit generation or refresh an existing canonical publication.

    Editing legacy materials does not establish unknown attachment ownership.
    Only an explicit generation BUILD may assign engine template sockets.
    """
    if context not in ('generation', 'update'):
        raise ValidationError('数字实体发布上下文无效')
    from .contracts import validate_envelope
    entity = deepcopy(envelope)
    # Existing slot assignments remain available to the compiler, while the
    # compatibility envelope receives its own independent material validation.
    legacy = {k:v for k,v in entity.items() if k != 'document'}
    validate_envelope(legacy)
    if context == 'update':
        if 'document' not in entity:
            return entity  # Preserve the legacy 2D contract without inventing mounts.
        validate_document(entity['document'])
    entity['document'] = compile_document(entity, key, title)
    return entity


def validate_document(document):
    try:
        validate_schema(document, document_schema())
        return _validate_document(document)
    except ValidationError:
        raise
    except (TypeError, KeyError, IndexError, AttributeError, ValueError):
        raise ValidationError('实体文档结构无效') from None
