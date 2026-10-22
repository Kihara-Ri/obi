"""Versioned, content-addressed artwork for the fixed sample library.

Only this public manifest is tracked. Binary originals live in an external
bundle; a working instance receives its own immutable publication resources.
"""
import base64
import hashlib
import json
import shutil
import sys
import time
from urllib.parse import urlsplit
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.seed_samples import RECORDS, check_target, existing_ids, open_store, seed
from tools.sample_reference_models import REFERENCE_MODELS
from tools.seed_reference_models import artwork_fetcher, engine_package, run as publish_references
from vendor.album_data.contracts import image_type, clean_entity
from vendor.album_data import compile_document

LOCK = ROOT / 'tools/sample-bundle.json'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode()


def guard(path):
    path = Path(path).resolve()
    actual = (ROOT / 'data').resolve()
    if path == actual or actual in path.parents:
        raise ValueError('拒绝访问正式 data/；请使用独立开发目录')
    return path


def contract():
    _, manifest, sha = engine_package()
    codec = ROOT / 'vendor/album_data/data-codec-manifest.json'
    codec_manifest = json.loads(codec.read_text())
    for name, expected in codec_manifest['sha256'].items():
        path = codec.parent / name
        if Path(name).name != name or digest(path.read_bytes()) != expected:
            raise ValueError('实体数据编解码器校验失败')
    if codec_manifest['version'] != manifest['version']:
        raise ValueError('插件与实体数据编解码器版本不匹配')
    return {'roster': digest(encoded(RECORDS)), 'plans': digest(encoded(REFERENCE_MODELS)),
            'engineVersion': manifest['version'], 'package': sha,
            'pluginManifest': digest(encoded(manifest)), 'dataCodec': digest(codec.read_bytes())}


def refresh_contract(bundle, lock_path=LOCK):
    """Re-lock existing public originals after an explicit engine package rebuild."""
    bundle = guard(bundle)
    value = json.loads(Path(lock_path).read_text())
    existing = json.loads((bundle / 'manifest.json').read_text())
    if existing != value:
        raise ValueError('素材包与原锁不一致，未更新')
    verify_contents(bundle, value)
    history = bundle / 'history'
    history.mkdir(exist_ok=True)
    (history / (digest(encoded(value)) + '.json')).write_bytes(encoded(value))
    value['sampleVersion'] = '2026-10-17.1'
    value['contract'] = contract()
    raw = encoded(value)
    Path(lock_path).write_bytes(raw)
    (bundle / 'manifest.json').write_bytes(raw)
    return verify(bundle, lock_path)


def canonical_image(raw, url):
    """Normalize Apple CDN's volatile EXIF UserComment, preserving JPEG scan bytes.

    No decoding/re-encoding: orientation/color profiles and all pixel data remain.
    Only Apple's EXIF UserComment varies between otherwise identical responses.
    """
    if not (urlsplit(url).hostname or '').endswith('.mzstatic.com') or not raw.startswith(b'\xff\xd8'):
        return raw
    offset, chunks = 2, [raw[:2]]
    while offset < len(raw):
        if raw[offset] != 255 or offset + 4 > len(raw):
            raise ValueError('无效 JPEG 段')
        marker = raw[offset + 1]
        if marker in (0xda, 0xd9):
            chunks.append(raw[offset:]); return b''.join(chunks)
        size = int.from_bytes(raw[offset + 2:offset + 4], 'big')
        end = offset + 2 + size
        if size < 2 or end > len(raw):
            raise ValueError('JPEG 段不完整')
        segment = raw[offset:end]
        # Preserve every segment, including EXIF orientation, ICC/APP2 and scan data.
        if marker == 0xe1 and segment[4:10] == b'Exif\x00\x00':
            segment = bytearray(segment)
            base = 10
            order = 'little' if segment[base:base + 2] == b'II' else 'big'
            def integer(at, size):
                if at < base or at + size > len(segment):
                    raise ValueError('EXIF 偏移无效')
                return int.from_bytes(segment[at:at + size], order)
            pending, visited = [integer(base + 4, 4)], set()
            while pending:
                relative = pending.pop()
                if not relative or relative in visited:
                    continue
                visited.add(relative)
                start = base + relative
                for index in range(integer(start, 2)):
                    entry = start + 2 + index * 12
                    tag, kind, count = integer(entry, 2), integer(entry + 2, 2), integer(entry + 4, 4)
                    pointer = integer(entry + 8, 4)
                    if tag == 0x8769 and kind == 4:
                        pending.append(pointer)
                    elif tag == 0x9286 and kind == 7 and count > 4:
                        at = base + pointer
                        if at < base or at + count > len(segment):
                            raise ValueError('EXIF 注释无效')
                        segment[at:at + count] = bytes(count)
            segment = bytes(segment)
        chunks.append(segment)
        offset = end
    raise ValueError('JPEG 缺少图像数据')


def capture(data_dir, reference_cache, bundle, lock_path=LOCK):
    """Freeze only public artwork of canonical samples; never serialize ledger data."""
    data_dir, reference_cache, bundle = map(guard, (data_dir, reference_cache, bundle))
    if check_target(data_dir):
        raise ValueError('请先准备完整的固定样本')
    ids = existing_ids(data_dir)
    records = {r['id']: r for r in open_store(data_dir).state()['records']}
    manifest = {'schemaVersion': 1, 'sampleVersion': '2026-10-17.1',
                'contract': contract(), 'assets': {}, 'covers': {}, 'references': {}}
    (bundle / 'assets').mkdir(parents=True, exist_ok=True)

    def add(raw, url):
        if not url.startswith('https://'):
            raise ValueError('样本素材须保留 HTTPS 来源')
        raw = canonical_image(raw, url)
        sha = digest(raw)
        filename = sha + '.' + image_type(raw)[0]
        manifest['assets'][sha] = {'file': filename, 'bytes': len(raw), 'url': url}
        (bundle / 'assets' / filename).write_bytes(raw)
        return sha

    for key, fixed in RECORDS:
        record = records[ids[key]]
        if not record.get('cover'):
            raise ValueError('固定样本缺封面：' + key)
        source = {k:v for k,v in record.get('coverSource', {}).items()
                  if k in ('provider', 'url', 'page', 'title', 'artist', 'country')}
        raw = (data_dir / 'covers' / record['cover'].split('/')[-1]).read_bytes()
        manifest['covers'][key] = {'asset': add(raw, source['url']), 'source': source}
    for key, plan in REFERENCE_MODELS.items():
        folder = reference_cache / key
        original = json.loads((folder / 'manifest.json').read_text())
        selected = list(plan['surfaces'].values()) + plan['components']
        selected += [c['back'] for c in plan['components'] if c.get('back')]
        wanted = {item['sourceId'] for item in selected}
        snapshot = {**original, 'images': [i for i in original['images'] if i['sourceId'] in wanted]}
        if {i['sourceId'] for i in snapshot['images']} != wanted:
            raise ValueError('发行图集缺面：' + key)
        files, discogs = {}, {}
        for item in snapshot['images']:
            files[item['file']] = add((folder / item['file']).read_bytes(), item['sourceUrl'])
            if item['sourceId'].startswith('discogs:'):
                ident = item['sourceId'].split(':')[1]
                discogs[ident] = json.loads((folder / ('discogs-' + ident + '.json')).read_text())
        manifest['references'][key] = {'release': json.loads((folder / 'release.json').read_text()),
                                      'manifest': snapshot, 'discogs': discogs, 'files': files}
    raw = encoded(manifest)
    (bundle / 'manifest.json').write_bytes(raw)
    Path(lock_path).write_bytes(raw)
    verify(bundle, lock_path)
    return manifest


def lock(lock_path=LOCK):
    value = json.loads(Path(lock_path).read_text())
    if value.get('schemaVersion') != 1 or value.get('contract') != contract():
        raise ValueError('样本版本与当前固定清单或引擎不匹配；请显式更新素材包')
    if set(value['covers']) != {key for key, _ in RECORDS} or set(value['references']) != set(REFERENCE_MODELS):
        raise ValueError('样本包不完整')
    return value


def verify(bundle, lock_path=LOCK):
    bundle = guard(bundle)
    expected = lock(lock_path)
    if json.loads((bundle / 'manifest.json').read_text()) != expected:
        raise ValueError('素材包 manifest 与锁定版本不一致')
    verify_contents(bundle, expected)
    return expected


def verify_contents(bundle, expected):
    for sha, asset in expected['assets'].items():
        if Path(asset['file']).name != asset['file']:
            raise ValueError('非法素材路径')
        path = bundle / 'assets' / asset['file']
        if not path.is_file() or path.stat().st_size != asset['bytes'] or digest(path.read_bytes()) != sha:
            raise ValueError('素材缺失或损坏：' + asset['file'])


DOWNLOAD_ATTEMPTS = 4


def download(bundle, lock_path=LOCK):
    """Explicit acquisition only; ordinary preview start never calls this."""
    bundle = guard(bundle)
    expected = lock(lock_path)
    from covers import CoverService
    covers, references = CoverService(), artwork_fetcher()
    (bundle / 'assets').mkdir(parents=True, exist_ok=True)
    for sha, asset in expected['assets'].items():
        path = bundle / 'assets' / asset['file']
        if path.is_file() and digest(path.read_bytes()) == sha:
            continue
        # Reuse the producer transports; canonicalize only volatile Apple EXIF.
        # CDNs occasionally serve a transient error or a different variant to a fresh
        # client (KNOWN-ISSUES I-013); retry with backoff, but never accept other bytes.
        for attempt in range(DOWNLOAD_ATTEMPTS):
            try:
                if (urlsplit(asset['url']).hostname or '').endswith('.mzstatic.com'):
                    raw = covers.read(asset['url'], 24 * 1024 * 1024)
                else:
                    raw, _ = references.request(asset['url'])
                raw = canonical_image(raw, asset['url'])
                problem = None if len(raw) == asset['bytes'] and digest(raw) == sha else 'mismatch'
            except Exception as error:  # network / HTTP errors from either transport
                problem = error
            if problem is None:
                break
            if attempt + 1 < DOWNLOAD_ATTEMPTS:
                print('RETRY', asset['file'], problem, flush=True)
                time.sleep(2 ** attempt)
        else:
            if problem != 'mismatch':
                raise problem
            raise ValueError('远端素材已变化，未接受替代图：' + asset['file'])
        image_type(raw)
        temp = path.with_suffix('.partial')
        temp.write_bytes(raw); temp.replace(path)
        print('FETCHED', asset['file'], flush=True)
    (bundle / 'manifest.json').write_bytes(encoded(expected))
    verified = verify(bundle, lock_path)
    keep = {asset['file'] for asset in expected['assets'].values()}
    for path in (bundle / 'assets').iterdir():
        stem = path.stem
        if path.name not in keep and len(stem) == 64 and all(c in '0123456789abcdef' for c in stem):
            path.unlink()
    return verified


def restore(bundle, data_dir, lock_path=LOCK):
    """Rebuild through the same fixed seed and publication transactions, offline."""
    bundle, data_dir = map(guard, (bundle, data_dir))
    manifest = verify(bundle, lock_path)
    ids = seed(data_dir)
    store = open_store(data_dir)
    for key, cover in manifest['covers'].items():
        record = next(r for r in store.state()['records'] if r['id'] == ids[key])
        filename = record.get('cover', '').split('/')[-1]
        path = data_dir / 'covers' / filename
        if path.is_file() and digest(path.read_bytes()) == cover['asset'] and record.get('coverSource') == cover['source']:
            continue
        asset = manifest['assets'][cover['asset']]
        raw = (bundle / 'assets' / asset['file']).read_bytes()
        store.save({'id': record['id'], 'revision': record['revision'], 'coverSource': cover['source'],
                    'cover': 'data:' + image_type(raw)[1] + ';base64,' + base64.b64encode(raw).decode()})
    cache = data_dir / 'reference-artwork'
    for key, reference in manifest['references'].items():
        folder = cache / key
        folder.mkdir(parents=True, exist_ok=True)
        (folder / 'release.json').write_bytes(encoded(reference['release']))
        (folder / 'manifest.json').write_bytes(encoded(reference['manifest']))
        for ident, metadata in reference['discogs'].items():
            (folder / ('discogs-' + ident + '.json')).write_bytes(encoded(metadata))
        for filename, sha in reference['files'].items():
            shutil.copyfile(bundle / 'assets' / manifest['assets'][sha]['file'], folder / filename)
    publish_references(data_dir, cache)
    # Publication is offline and data-only; install afterwards pins the user's GLBs.
    from server.engine_plugins import PluginManager
    PluginManager(store, None, None).install()
    shutil.rmtree(cache)  # Originals remain in bundle + frozen publication; no third cache copy.
    (data_dir / 'sample-preview.json').write_bytes(encoded({'sampleVersion': manifest['sampleVersion'],
                                                          'bundleDigest': digest(encoded(manifest))}))
    return check(bundle, data_dir, lock_path)


def check(bundle, data_dir, lock_path=LOCK):
    manifest = verify(bundle, lock_path)
    data_dir = guard(data_dir)
    if check_target(data_dir):
        raise ValueError('开发样本实例尚未初始化')
    marker = json.loads((data_dir / 'sample-preview.json').read_text())
    if marker != {'sampleVersion': manifest['sampleVersion'], 'bundleDigest': digest(encoded(manifest))}:
        raise ValueError('开发实例版本不同；请 prepare --rebuild，原实例将完整归档')
    ids, store = existing_ids(data_dir), open_store(data_dir)
    records = {r['id']: r for r in store.state()['records']}
    for key, cover in manifest['covers'].items():
        source = records[ids[key]].get('cover', '').split('/')[-1]
        if not source or digest((data_dir / 'covers' / source).read_bytes()) != cover['asset']:
            raise ValueError('开发实例封面缺失或损坏：' + key)
    jobs, models = store.twin_index()['jobs'], []
    _, plugin_manifest, _ = engine_package()
    prefix = plugin_manifest['models'] + '/'
    expected_models = {name[len(prefix):]: sha for name, sha in plugin_manifest['sha256'].items() if name.startswith(prefix)}
    for key, reference in manifest['references'].items():
        record, job = records[ids[key]], jobs.get(ids[key])
        if not job or job['status'] != 'succeeded' or job['releaseId'] != REFERENCE_MODELS[key]['releaseId']:
            raise ValueError('开发实例缺少有效发布模型：' + key)
        assets = []
        expected = {('caa-' + name if name[0].isdigit() else name): sha for name, sha in reference['files'].items()}
        document = job['entity']['document']
        # The same asset set may still be bound to the wrong printed faces.
        sources = {}
        for item in reference['manifest']['images']:
            sid = item['sourceId']
            sources[sid] = {'asset': ('caa-' if sid.startswith('caa:') else '') + item['file'],
                            'origin': 'edition-reference', 'sourceUrl': item['sourceUrl']}
        plan = REFERENCE_MODELS[key]
        envelope = clean_entity({'sameAlbum':True, **{k:plan[k] for k in ('packaging','surfaces','components')}}, sources)
        if 'presentation' in document: envelope['presentation'] = document['presentation']
        expected_document = compile_document(envelope, job['id'], record['title'])
        if document != expected_document:
            raise ValueError('发布模型印刷面绑定不符：' + key)
        if set(document['assets']) != set(expected):
            raise ValueError('发布模型资产清单发生变化：' + key)
        for name, sha in expected.items():
            raw = store.twin_source(job['id'], name).read_bytes()
            if digest(raw) != sha:
                raise ValueError('发布模型贴图损坏：' + name)
            assets.append({'url': '/api/twin-assets/' + job['id'] + '/' + name, 'sha256': sha})
        pinned = job.get('models')
        if not pinned or pinned.get('version') != manifest['contract']['engineVersion']:
            raise ValueError('发布模型缺少持久资源清单：' + key)
        if (pinned.get('modelSet') != plugin_manifest['modelSet'] or set(pinned.get('files', {})) != set(expected_models)):
            raise ValueError('发布模型资源清单不完整：' + key)
        for name, sha in expected_models.items():
            entry = pinned['files'][name]
            path = store.published_twin_model_asset(job['id'], name)
            if entry.get('sha256') != sha or digest(path.read_bytes()) != sha:
                raise ValueError('发布模型资源损坏：' + name)
        models.append({'title': record['title'], 'recordId': record['id'], 'jobId': job['id'], 'assets': assets})
    cover_assets = [{'recordId':ids[key], 'url':records[ids[key]]['cover'], 'sha256':cover['asset']}
                    for key, cover in manifest['covers'].items()]
    return {**marker, 'copies': len(ids), 'covers': len(ids), 'galleryCount': 16,
            'coverAssets':cover_assets, 'models': models}
