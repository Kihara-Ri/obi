#!/usr/bin/env python3
"""Fetch and publish real edition references ONLY into the fixed sample library.

Network/source validation and publication compilation belong to Album Engine.
This adapter selects fixed sample IDs and commits through Store transactions.
No downloaded artwork is tracked or treated as a sample's physical photograph.
"""
import argparse
import base64
import hashlib
import json
import shutil
import sys
import tempfile
import types
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.sample_reference_models import REFERENCE_MODELS
from tools.seed_samples import check_target, open_store, seed, uid
from vendor.album_data.contracts import clean_entity, image_type


def engine_package():
    """Read the official packaged tool without needing an installed instance."""
    from server.engine_plugins import validate_manifest
    catalog_dir = ROOT / 'plugins/album-engine'
    catalog = json.loads((catalog_dir / 'catalog.json').read_text())
    name = catalog['file']
    if not isinstance(name, str) or Path(name).name != name:
        raise ValueError('插件目录中的软件包路径无效')
    archive = catalog_dir / name
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    if digest != catalog['sha256']:
        raise ValueError('官方插件软件包校验失败')
    with zipfile.ZipFile(archive) as package:
        manifest = validate_manifest(json.loads(package.read('manifest.json')))
    if manifest['version'] != catalog['version']:
        raise ValueError('插件目录版本不匹配')
    return archive, manifest, digest


def artwork_fetcher():
    archive, manifest, _ = engine_package()
    name = manifest['runtime'] + '/skill/scripts/fetch_release_art.py'
    with zipfile.ZipFile(archive) as package:
        raw = package.read(name)
    if hashlib.sha256(raw).hexdigest() != manifest['sha256'].get(name):
        raise ValueError('发行版素材工具校验失败')
    module = types.ModuleType('engine_reference_fetcher')
    module.__file__ = str(archive) + '/' + name
    exec(compile(raw, module.__file__, 'exec'), module.__dict__)
    return module


def load_reference(key, directory, fetcher):
    plan = REFERENCE_MODELS[key]
    path = directory / 'manifest.json'
    if not path.is_file():
        # Fetch into a fresh staging directory. A failed request must not leave
        # an existing output directory that prevents the next explicit retry.
        directory.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.reference-fetch-', dir=directory.parent) as temp:
            staged = Path(temp) / 'originals'
            fetcher.fetch(plan['releaseId'], staged)
            result = load_reference(key, staged, fetcher)
            shutil.copytree(staged, directory, dirs_exist_ok=True)
            return result
    manifest = json.loads(path.read_text())
    release = json.loads((directory / 'release.json').read_text())
    if manifest.get('releaseId') != plan['releaseId'] or release.get('id') != plan['releaseId']:
        raise ValueError('Reference cache belongs to a different release: ' + key)
    if not fetcher.is_cd(release):
        raise ValueError('Reference edition is not CD: ' + key)
    references = {item['sourceId']: item for item in manifest['images'] if item['status'] == 'downloaded'}
    selected = list(plan['surfaces'].values()) + plan.get('components', [])
    selected += [part['back'] for part in plan.get('components', []) if part.get('back')]
    sources, originals = {}, {}
    for item in selected:
        sid = item['sourceId']
        if sid in sources:
            continue
        reference = references.get(sid)
        if reference is None:
            raise ValueError('Required reference is unavailable: ' + sid)
        filename = reference['file']
        if Path(filename).name != filename:
            raise ValueError('Invalid reference cache filename')
        original = directory / filename
        raw = original.read_bytes()
        if fetcher.dimensions(original) != reference['pixels'] or len(raw) != reference['bytes']:
            raise ValueError('Incomplete cached original: ' + sid)
        if sid.startswith('discogs:'):
            ident = sid.split(':')[1]
            data = json.loads((directory / ('discogs-' + ident + '.json')).read_text())
            if not fetcher.verify_discogs(release, data):
                raise ValueError('Discogs edition identity mismatch: ' + sid)
        asset = ('caa-' + filename) if sid.startswith('caa:') else filename
        sources[sid] = {'asset': asset, 'origin': 'edition-reference', 'sourceUrl': reference['sourceUrl']}
        originals[asset] = raw
    entity = clean_entity({'sameAlbum': True, 'packaging': plan['packaging'],
                           'surfaces': plan['surfaces'], 'components': plan.get('components', []),
                           'warnings': ['固定样本的发行版图集参考；非实物副本照片，尺寸为标准比例。'],
                           **({'presentation': plan['presentation']} if 'presentation' in plan else {})}, sources)
    fingerprint = hashlib.sha256(json.dumps(plan, sort_keys=True).encode())
    for asset, raw in sorted(originals.items()):
        fingerprint.update(asset.encode()); fingerprint.update(raw)
    return release, manifest, entity, originals, fingerprint.hexdigest()


def run(data_dir, reference_cache=None):
    target = Path(data_dir).resolve()
    check_target(target)
    ids = seed(target)
    cache = Path(reference_cache).resolve() if reference_cache else target / 'reference-artwork'
    # Apply the same real-data protection to source cache writes.
    actual = (ROOT / 'data').resolve()
    if cache == actual or actual in cache.parents:
        raise SystemExit('拒绝将参考缓存写入真实 data/')
    store, fetcher = open_store(target), artwork_fetcher()
    cache.mkdir(parents=True, exist_ok=True)
    report_path = target / 'sample-reference-model-report.json'
    report = json.loads(report_path.read_text()) if report_path.is_file() else {}
    for key, plan in REFERENCE_MODELS.items():
        # Finish source verification before changing the sample copy or its task.
        release, manifest, entity, originals, fingerprint = load_reference(key, cache / key, fetcher)
        rid = ids[key]
        current = store.twin_index()['jobs'].get(rid)
        record = next(r for r in store.state()['records'] if r['id'] == rid)
        front = entity['surfaces']['front']
        cover_raw, cover_url = originals[front['asset']], front['sourceUrl']
        use_thumbnail = len(cover_raw) > 2_000_000 and cover_url.startswith('https://coverartarchive.org/')
        if use_thumbnail:
            cover_url = cover_url.removesuffix('.jpg') + '-500.jpg'
        matching_cover = bool(record.get('cover')) and (record.get('coverSource') or {}).get('url') == cover_url
        prior = report.get(key, {})
        if (current and current['status'] == 'succeeded' and prior.get('fingerprint') == fingerprint
                and prior.get('jobId') == current['id'] and matching_cover
                and current.get('entity', {}).get('components', []) == entity.get('components', [])):
            print('REFERENCE_UNCHANGED', key, flush=True)
            continue
        if (current and current['status'] == 'succeeded' and matching_cover
                and current['releaseId'] == release['id']
                and current['entity']['packaging'] == entity['packaging']
                and current['entity']['surfaces'] == entity['surfaces']):
            # A material-only accessory correction uses the existing explicit
            # update transaction, preserving publication identity and slots.
            selected, downloaded = [], {}
            for part in entity.get('components', []):
                item = {'id': part['id'], 'kind': part['kind'], 'sourceId': part['asset']}
                for field in ('region', 'fold'):
                    if field in part: item[field] = part[field]
                sides = [part]
                if part.get('back'):
                    back = part['back']; sides.append(back)
                    item['back'] = {'sourceId': back['asset'],
                                    **({'region': back['region']} if 'region' in back else {})}
                selected.append(item)
                for side in sides:
                    downloaded[side['asset']] = (side, originals[side['asset']])
            store.set_twin_accessories(current['id'], selected, downloaded)
            report[key] = {'releaseId': release['id'], 'jobId': current['id'], 'fingerprint': fingerprint,
                           'evidence': plan['evidence'], 'assets': {asset: hashlib.sha256(raw).hexdigest()
                                                                 for asset, raw in originals.items()}}
            report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
            print('REFERENCE_UPDATED', key, len(originals), flush=True)
            continue
        if current and current.get('releaseId') == release['id']:
            presentation = current.get('entity', {}).get('document', {}).get('presentation')
            if presentation is not None and 'presentation' not in entity:
                entity['presentation'] = presentation
        info = dict(record.get('releaseInfo') or {})
        info.update(musicBrainzReleaseId=release['id'], barcode=release.get('barcode', ''))
        patch = {'id': rid, 'revision': record['revision'], 'releaseInfo': info, 'packaging': plan['packaging']}
        if not matching_cover:
            if use_thumbnail:
                thumbnail = cache / key / 'front-thumbnail.jpg'
                if not thumbnail.is_file():
                    raw, _ = fetcher.request(cover_url)
                    image_type(raw)
                    thumbnail.write_bytes(raw)
                fetcher.dimensions(thumbnail)
                cover_raw = thumbnail.read_bytes()
            patch['cover'] = 'data:' + image_type(cover_raw)[1] + ';base64,' + base64.b64encode(cover_raw).decode('ascii')
            patch['coverSource'] = {'provider': 'Edition reference', 'url': cover_url,
                                    'page': 'https://musicbrainz.org/release/' + release['id'],
                                    'title': record['title'], 'artist': record['artist']}
        if current and current.get('releaseId', '').startswith('00000000-'):
            patch['photos'] = []  # Remove only the explicitly synthetic geometry fixture photos.
        store.save(patch)
        record = next(r for r in store.state()['records'] if r['id'] == rid)
        body = {'recordId': rid, 'recordRevision': record['revision'], 'requestId': uid()}
        if current:
            body['expectedJobId'] = current['id']
        job = store.start_twin(body)['job']
        if job['status'] != 'queued':
            raise ValueError('Sample has an active or unchanged task; reference not overwritten: ' + key)
        claimed = store.claim_twin('sample-reference-library')
        if not claimed or claimed['id'] != job['id']:
            raise ValueError('Another sample task is queued; stop its worker before seeding references')
        for asset, raw in originals.items():
            store.write_twin_source(job['id'], claimed['claim'], asset, raw)
        if not store.update_twin(job['id'], claimed['claim'], status='succeeded', phase='published',
                                 releaseId=release['id'], releaseData=release, artData=manifest,
                                 message='固定样本：已核对同版图集的参考模型', entity=entity):
            raise ValueError('Reference publication lost its task claim')
        report[key] = {'releaseId': release['id'], 'jobId': job['id'], 'fingerprint': fingerprint,
                       'evidence': plan['evidence'], 'assets': {asset: hashlib.sha256(raw).hexdigest()
                                                             for asset, raw in originals.items()}}
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print('REFERENCE_PUBLISHED', key, len(originals), flush=True)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', required=True)
    parser.add_argument('--reference-cache')
    args = parser.parse_args()
    run(args.data_dir, args.reference_cache)
