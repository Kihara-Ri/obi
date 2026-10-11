#!/usr/bin/env python3
"""Fetch edition metadata and untouched CAA originals; never write album records."""
import argparse
import datetime
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from uuid import UUID

USER_AGENT = 'AlbumDigitalTwin/1.0 (local edition artwork research)'


def release_id(value):
    match = re.fullmatch(r'https://musicbrainz\.org/release/([0-9a-f-]+)/?(?:cover-art/?)?', value)
    candidate = match[1] if match else value
    try:
        return str(UUID(candidate))
    except ValueError as error:
        raise argparse.ArgumentTypeError('Use a MusicBrainz release URL or MBID') from error


def request(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': USER_AGENT}), timeout=40) as response:
                return response.read(), response.geturl()
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
            time.sleep(min(10, 2 ** (attempt + 1)))


def extension(content):
    if content.startswith(b'\xff\xd8\xff'): return '.jpg'
    if content.startswith(b'\x89PNG\r\n\x1a\n'): return '.png'
    if content.startswith(b'RIFF') and content[8:12] == b'WEBP': return '.webp'
    if content.startswith((b'GIF87a', b'GIF89a')): return '.gif'
    raise ValueError('Original response is not a supported image')


def dimensions(path):
    try:
        from PIL import Image
        with Image.open(path) as image:
            return list(image.size)
    except ImportError:
        return None


def fetch(rid, output):
    output.mkdir(parents=True, exist_ok=False)
    mb_url = f'https://musicbrainz.org/ws/2/release/{rid}?fmt=json&inc=artist-credits+labels+recordings'
    caa_url = f'https://coverartarchive.org/release/{rid}'
    raw, _ = request(mb_url)
    release = json.loads(raw); (output / 'release.json').write_bytes(raw)
    manifest = {'releaseId': rid, 'releaseUrl': f'https://musicbrainz.org/release/{rid}',
                'title': release['title'], 'artistCredit': release.get('artist-credit', []),
                'media': release.get('media', []), 'packaging': release.get('packaging'),
                'barcode': release.get('barcode'), 'labels': release.get('label-info', []),
                'fetchedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'images': [], 'errors': [], 'scope': 'edition reference; physical copy unconfirmed'}
    try:
        raw, _ = request(caa_url)
        art = json.loads(raw); (output / 'cover-art.json').write_bytes(raw)
        for entry in art.get('images', []):
            ident = str(entry['id'])
            if not ident.isdecimal(): raise ValueError('Invalid CAA image id')
            url = f'https://coverartarchive.org/release/{rid}/{ident}.jpg'
            item = {'id': ident, 'types': entry.get('types', []), 'comment': entry.get('comment', ''),
                    'approved': entry.get('approved'), 'sourceUrl': url}
            try:
                content, resolved = request(url)
                path = output / (ident + extension(content)); path.write_bytes(content)
                item.update(file=path.name, pixels=dimensions(path), bytes=len(content), resolvedUrl=resolved, status='downloaded')
            except (OSError, ValueError) as error:
                item.update(status='failed', error=str(error)); manifest['errors'].append({'imageId': ident, 'error': str(error)})
            manifest['images'].append(item)
            print(json.dumps({'imageId': ident, 'types': item['types'], 'status': item['status'],
                              'pixels': item.get('pixels')}, ensure_ascii=False), flush=True)
    except (OSError, ValueError) as error:
        manifest['errors'].append({'scope': 'cover-art-list', 'error': str(error)})
    roles = {role for entry in manifest['images'] if entry['status'] == 'downloaded' for role in entry['types']}
    manifest['absentRoles'] = sorted({'Front', 'Back', 'Spine', 'Booklet', 'Tray', 'Medium'} - roles)
    manifest['status'] = 'partial' if manifest['errors'] else 'retrieved'
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('release', type=release_id)
    parser.add_argument('--output', type=Path, required=True, help='A new directory for reference originals')
    args = parser.parse_args()
    try:
        manifest = fetch(args.release, args.output)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Failed: {error}\n')
    print(json.dumps({'title': manifest['title'], 'status': manifest['status'],
                      'downloaded': sum(i['status'] == 'downloaded' for i in manifest['images']),
                      'absentRoles': manifest['absentRoles'], 'manifest': str(args.output / 'manifest.json')}, ensure_ascii=False))
    return 1 if manifest['errors'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
