#!/usr/bin/env python3
"""Real digital-first album covers for fixed demo albums.

Works only on an existing seed_samples database. All network calls go through
the project's MusicBrainzClient and CoverService; no fabricated pictures and
iTunes is preferred on exact title/artist matches. CAA release-group artwork is
labelled as a work cover, NOT evidence of the specific physical edition.
"""
import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from covers import CoverService
from musicbrainz import MusicBrainzClient
from domain import ValidationError
from tools.seed_samples import RECORDS, existing_ids, open_store, check_target

# An exact MusicBrainz spelling verified against the target recording/release
# group. The local collection's human-readable title stays unchanged.
MB_TITLE_ALIASES = {
    'minecraft': ('Minecraft – Volume Alpha', 'C418'),
    'lift-fists': ('Lift Yr. Skinny Fists Like Antennas to Heaven!', 'Godspeed You Black Emperor!'),
}

# Reviewed MusicBrainz release-group IDs resolve exact-name collisions.
# First Love Album vs Single; MBDTF 2010 Album vs 2020 Demo.
PINNED_MB_GROUPS = {
    'first-love': 'c60fcd45-9420-30aa-98e5-2bffb894021a',
    'mbdtf': '5d6e21e1-deb5-428e-bb42-c2a567f3619b',
    'lift-fists': '3822abb6-ca53-3ae1-a4ec-7718cb321e9b',
}



def legacy_hashes():
    return json.loads((ROOT/'tools/legacy_synthetic_asset_hashes.json').read_text())


def purge_synthetic(data_dir, ids):
    """Remove only verified legacy fake pixels, never manually uploaded images."""
    store = open_store(data_dir)
    records = {r['id']: r for r in store.state()['records']}
    expected = legacy_hashes()
    removed = {'covers': 0, 'photos': 0}
    for key, _ in RECORDS:
        record = records[ids[key]]
        files = sorted((Path(data_dir)/'photos'/record['id']).glob('[0-9]*.*'),
                       key=lambda p: int(p.stem)) if record.get('photoCount') else []
        known = expected[key]
        only_fake_photos = (bool(files) and len(files) == len(known['photos'])
                            and all(hashlib.sha256(path.read_bytes()).hexdigest() == digest
                                    for path, digest in zip(files, known['photos'])))
        cover_file = Path(data_dir)/'covers'/str(record.get('cover','')).split('/')[-1]
        fake_cover = (record.get('cover','').startswith('/api/cover/')
                      and cover_file.is_file()
                      and hashlib.sha256(cover_file.read_bytes()).hexdigest() == known['front'])
        if not fake_cover and not only_fake_photos:
            continue
        patch = {'id':record['id'], 'revision':record['revision']}
        if fake_cover: patch.update(cover='', coverSource={})
        if only_fake_photos:
            spec = dict(record.get('packaging') or {})
            for field in ('photos','photoRegions','photoWarpRows'): spec.pop(field, None)
            patch.update(photos=[], packaging=spec)
        store.save(patch)
        removed['covers'] += int(fake_cover)
        removed['photos'] += len(files) if only_fake_photos else 0
        # A synthetic cover is not evidence and must not linger in the sample
        # asset directory once no record references it.
        if fake_cover and not any(r.get('cover') == record.get('cover')
                                  for r in store.state()['records']):
            cover_file.unlink(missing_ok=True)
    print('PURGED_SYNTHETIC',json.dumps(removed),flush=True)
    return removed


def fetch_covers(data_dir, ids, cover_service=None):
    # Upgrade only CAA images previously auto-selected by the sample script.
    # All manual/iTunes images remain untouched.
    store = open_store(data_dir)
    cover_service = cover_service or CoverService(
        Path(data_dir)/'cover-cache.sqlite3', MusicBrainzClient())
    results, itunes_selected, archive_selected = [], {}, {}

    def report():
        (Path(data_dir)/'musicbrainz-cover-report.json').write_text(
            json.dumps(results, ensure_ascii=False, indent=2)+'\n')

    for i,(key, entry) in enumerate(RECORDS, 1):
        album = next(r for r in store.state()['records'] if r['id']==ids[key])
        provider = (album.get('coverSource') or {}).get('provider','')
        existing_caa = bool(album.get('cover')) and provider == 'MusicBrainz / Cover Art Archive'
        if album.get('cover') and not existing_caa:
            print('SKIP_EXISTING',i,key,flush=True)
            results.append({'key':key,'status':'existing'}); report(); continue
        lookup = MB_TITLE_ALIASES.get(key, (entry['title'], entry['artist']))
        try:
            if lookup not in itunes_selected:
                try:
                    found = cover_service.layered_search(*lookup)
                    exact = [c for c in found.get('candidates', [])
                             if c.get('exact') and c.get('provider') == 'iTunes']
                    itunes_selected[lookup] = exact[0] if exact else None
                except (ValidationError, AttributeError) as exc:
                    print('ITUNES_UNAVAILABLE',key,str(exc)[:100],flush=True)
                    itunes_selected[lookup] = None
            candidate = itunes_selected[lookup]
            if not candidate and existing_caa:
                print('KEEP_CAA',i,key,flush=True)
                results.append({'key':key,'status':'existing-caa'}); report(); continue
            if not candidate:
                if lookup not in archive_selected:
                    for attempt in range(3):
                        try:
                            candidates = cover_service.archive_candidates(*lookup)
                            exact = [c for c in candidates if c.get('exact')
                                     and c.get('provider') == 'MusicBrainz / Cover Art Archive']
                            pinned = PINNED_MB_GROUPS.get(key)
                            if pinned:
                                archive_selected[lookup] = next((c for c in exact
                                    if c['token'] == 'CAA-' + pinned), None)
                            else:
                                archive_selected[lookup] = exact[0] if len(exact)==1 else None
                            if not archive_selected[lookup]:
                                print('NO_UNIQUE_MB_MATCH',key,'candidates',len(exact),flush=True)
                            break
                        except ValidationError as exc:
                            if attempt == 2: raise
                            print('RETRY_MB',key,attempt + 1,str(exc)[:80],flush=True)
                            time.sleep(4 * (attempt + 1))
                candidate = archive_selected[lookup]
            if candidate is None:
                results.append({'key':key,'status':'no-unique-match'});report();continue
            try:
                artwork = cover_service.download(candidate['token'])
            except ValidationError:
                if existing_caa:
                    results.append({'key':key,'status':'existing-caa'});report();continue
                raise
            if not artwork.get('cover','').startswith('data:image/'):
                raise ValidationError('Artwork source did not return an image')
            store.save({'id':album['id'],'revision':album['revision'],
                        'cover':artwork['cover'],'coverSource':artwork['coverSource']})
            status = 'upgraded-to-itunes' if existing_caa else 'saved'
            print('COVER_SAVED',i,key,candidate['token'],flush=True)
            results.append({'key':key,'status':status,
                            'provider':artwork['coverSource'].get('provider',''),
                            'page':artwork['coverSource'].get('page','')})
        except Exception as exc:
            print('SOURCE_ERROR',i,key,type(exc).__name__,str(exc)[:140],flush=True)
            results.append({'key':key,'status':'error','message':str(exc)[:200]})
        report()
    print('SUMMARY',json.dumps(
        {status:sum(r['status']==status for r in results)
         for status in {r['status'] for r in results}}),flush=True)
    return results


def run(data_dir, fetch=True):
    data_dir = Path(data_dir).resolve()
    if check_target(data_dir):
        raise SystemExit('请先使用 seed_samples.py 创建样本库')
    ids = existing_ids(data_dir)
    purge_synthetic(data_dir,ids)
    return fetch_covers(data_dir,ids) if fetch else []


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--data-dir',required=True)
    parser.add_argument('--purge-only',action='store_true',
                        help='清除旧合成图，但暂不联网获取')
    args=parser.parse_args()
    run(args.data_dir,fetch=not args.purge_only)
