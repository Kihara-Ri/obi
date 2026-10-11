#!/usr/bin/env python3
"""Find exact-barcode CD candidates, then fetch a confirmed edition's untouched reference art."""
import argparse
import datetime
import json
import re
import struct
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from uuid import UUID

USER_AGENT = 'AlbumDigitalTwin/3.0 (local edition artwork research)'


def source_url(value, host=None):
    if not isinstance(value, str) or not value or len(value) > 2048: return False
    try:
        parsed = urllib.parse.urlsplit(value)
        allowed = (parsed.hostname in ('musicbrainz.org', 'coverartarchive.org', 'api.discogs.com', 'i.discogs.com', 'archive.org')
                   or (parsed.hostname or '').endswith('.archive.org'))
        return (parsed.scheme == 'https' and allowed and (host is None or parsed.hostname == host)
                and parsed.port in (None, 443) and not parsed.username and not parsed.password
                and bool(parsed.path) and not parsed.fragment)
    except ValueError: return False


class SourceRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        old = urllib.parse.urlsplit(req.full_url)
        host = old.hostname if old.hostname in ('musicbrainz.org', 'api.discogs.com', 'i.discogs.com') else None
        if not source_url(newurl, host): raise ValueError('Source returned an unsupported redirect')
        if host is None and urllib.parse.urlsplit(newurl).hostname not in ('coverartarchive.org', 'archive.org') and not (urllib.parse.urlsplit(newurl).hostname or '').endswith('.archive.org'):
            raise ValueError('Artwork redirect must remain in CAA/Internet Archive')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def release_id(value):
    match = re.fullmatch(r'https://musicbrainz\.org/release/([0-9a-f-]+)/?(?:cover-art/?)?', value)
    candidate = match[1] if match else value
    try:
        return str(UUID(candidate))
    except ValueError as error:
        raise argparse.ArgumentTypeError('Use a MusicBrainz release URL or MBID') from error


def request(url):
    if not source_url(url): raise ValueError('Unsupported source URL')
    # This CLI makes MB requests sequentially; leave their required one-second interval.
    if urllib.parse.urlsplit(url).hostname == 'musicbrainz.org': time.sleep(1.1)
    for attempt in range(3):
        try:
            with urllib.request.build_opener(SourceRedirect()).open(urllib.request.Request(url, headers={'User-Agent': USER_AGENT}), timeout=40) as response:
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
    """Validate source headers and complete containers; decode read-only when PIL is installed."""
    content = path.read_bytes()
    if content.startswith(b'\xff\xd8') and (not content.endswith(b'\xff\xd9') or b'\xff\xda' not in content):
        raise ValueError('JPEG is truncated or has no image scan')
    if content.startswith(b'\x89PNG\r\n\x1a\n') and not content.endswith(b'\x00\x00\x00\x00IEND\xae\x42\x60\x82'):
        raise ValueError('PNG is truncated or has no end chunk')
    if content.startswith((b'GIF87a', b'GIF89a')) and (not content.endswith(b';') or b',' not in content[10:]):
        raise ValueError('GIF is truncated or has no image frame')
    if content.startswith(b'RIFF') and content[8:12] == b'WEBP' and (len(content) < 12 or int.from_bytes(content[4:8], 'little') + 8 != len(content)):
        raise ValueError('WebP container length does not match its data')
    try:
        from PIL import Image
    except ImportError:
        pass
    else:
        with Image.open(path) as image:
            image.load()
            return list(image.size)
    if content.startswith(b'\x89PNG\r\n\x1a\n') and len(content) >= 24:
        return list(struct.unpack('>II', content[16:24]))
    if content.startswith((b'GIF87a', b'GIF89a')) and len(content) >= 10:
        return list(struct.unpack('<HH', content[6:10]))
    if content.startswith(b'\xff\xd8'):
        index = 2
        while index + 4 <= len(content):
            if content[index] != 255: index += 1; continue
            while index < len(content) and content[index] == 255: index += 1
            if index >= len(content): break
            marker = content[index]; index += 1
            if marker in (0, 1, 216, 217) or 208 <= marker <= 215: continue
            if index + 2 > len(content): break
            size = int.from_bytes(content[index:index + 2], 'big')
            if size < 2: break
            if index + size > len(content): raise ValueError('JPEG header segment is truncated')
            if marker in (192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207) and size >= 8:
                height, width = struct.unpack('>HH', content[index + 3:index + 7])
                return [width, height]
            index += size
    if content.startswith(b'RIFF') and content[8:12] == b'WEBP':
        if content[12:16] == b'VP8X' and len(content) >= 30:
            return [int.from_bytes(content[24:27], 'little') + 1, int.from_bytes(content[27:30], 'little') + 1]
        if content[12:16] == b'VP8L' and len(content) >= 25 and content[20] == 47:
            bits = int.from_bytes(content[21:25], 'little')
            return [(bits & 16383) + 1, ((bits >> 14) & 16383) + 1]
        if content[12:16] == b'VP8 ' and len(content) >= 30 and content[23:26] == b'\x9d\x01\x2a':
            return [int.from_bytes(content[26:28], 'little') & 16383, int.from_bytes(content[28:30], 'little') & 16383]
    return None


def clean_barcode(value):
    value = re.sub(r'[\s-]', '', unicodedata.normalize('NFKC', value))
    if not re.fullmatch(r'(?:[0-9]{8}|[0-9]{12,14})', value): raise ValueError('Provide a complete 8, 12, 13 or 14 digit barcode')
    checksum = sum(int(n) * (3 if i % 2 == 0 else 1) for i, n in enumerate(reversed(value[:-1])))
    if (checksum + int(value[-1])) % 10: raise ValueError('Barcode check digit is invalid')
    return value


def is_cd(release):
    return any('CD' in str(medium.get('format', '')).upper() for medium in release.get('media', []))


def release_summary(release):
    return {'releaseId': release['id'], 'releaseUrl': f'https://musicbrainz.org/release/{release["id"]}',
            'title': release.get('title', ''), 'artistCredit': release.get('artist-credit', []),
            'date': release.get('date', ''), 'country': release.get('country', ''),
            'barcode': release.get('barcode'), 'labels': release.get('label-info', []),
            'media': release.get('media', []), 'packaging': release.get('packaging')}


def find_candidates(barcode):
    barcode = clean_barcode(barcode)
    query = urllib.parse.urlencode({'query': f'barcode:{barcode} AND format:CD', 'fmt': 'json', 'limit': 100})
    raw, _ = request('https://musicbrainz.org/ws/2/release?' + query)
    response = json.loads(raw)
    candidates = [release_summary(entry) for entry in response.get('releases', [])
                  if entry.get('barcode') == barcode and is_cd(entry)]
    return {'status': 'awaiting_confirmation', 'barcode': barcode, 'candidates': candidates,
            'fetchedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'searchComplete': int(response.get('count', len(response.get('releases', [])))) <= 100}


def discogs_release_ids(release):
    found = []
    for relation in release.get('relations', []):
        if relation.get('type') != 'discogs': continue
        resource = relation.get('url', {}).get('resource', '')
        match = re.fullmatch(r'https://(?:www\.)?discogs\.com/(?:[a-z]{2}/)?release/([0-9]+)(?:[-/?#].*)?', resource)
        if match and match[1] not in found: found.append(match[1])
    return found


def verify_discogs(release, reference):
    if not isinstance(reference, dict) or type(reference.get('id')) is not int:
        raise ValueError('Discogs returned invalid release metadata')
    for key in ('identifiers', 'labels', 'formats', 'images'):
        entries = reference.get(key, [])
        if not isinstance(entries, list) or any(not isinstance(entry, dict) for entry in entries):
            raise ValueError(f'Discogs returned invalid {key}')
    barcode = release.get('barcode')
    barcodes = set()
    for item in reference.get('identifiers', []):
        if item.get('type') != 'Barcode' or not isinstance(item.get('value'), str): continue
        try: barcodes.add(clean_barcode(item['value']))
        except ValueError: continue
    def catalog(value):
        return re.sub(r'\s+', '', unicodedata.normalize('NFKC', value)).upper() if isinstance(value, str) else ''
    catalogs = {catalog(item.get('catalog-number', '')) for item in release.get('label-info', []) if isinstance(item, dict)} - {''}
    other_catalogs = {catalog(item.get('catno', '')) for item in reference.get('labels', [])} - {''}
    return bool(barcode and barcode in barcodes and catalogs & other_catalogs and
                any(str(item.get('name', '')).upper() == 'CD' for item in reference.get('formats', [])))


def download_image(item, output, filename, manifest):
    try:
        if item.get('provider') == 'Discogs' and not source_url(item.get('sourceUrl'), 'i.discogs.com'):
            raise ValueError('Discogs artwork must use HTTPS on i.discogs.com')
        content, resolved = request(item['sourceUrl'])
        path = output / (filename + extension(content)); path.write_bytes(content)
        pixels = dimensions(path)
        if pixels is None or any(type(n) is not int or n <= 0 for n in pixels):
            raise ValueError('Original image has no readable supported dimensions')
        item.update(file=path.name, pixels=pixels, bytes=len(content), resolvedUrl=resolved, status='downloaded')
    except (OSError, ValueError) as error:
        item.update(status='failed', error=str(error))
        manifest['errors'].append({'imageId': item['sourceId'], 'error': str(error)})
    manifest['images'].append(item)
    print(json.dumps({'sourceId': item['sourceId'], 'types': item.get('types', []), 'status': item['status'],
                      'pixels': item.get('pixels')}, ensure_ascii=False), flush=True)


def fetch(rid, output, expected_barcode=None):
    if 'data' in output.resolve().parts: raise ValueError('Use a new reference directory outside application data')
    output.mkdir(parents=True, exist_ok=False)
    mb_url = f'https://musicbrainz.org/ws/2/release/{rid}?fmt=json&inc=artist-credits+labels+recordings+url-rels'
    caa_url = f'https://coverartarchive.org/release/{rid}'
    raw, _ = request(mb_url)
    release = json.loads(raw); (output / 'release.json').write_bytes(raw)
    if release.get('id') != rid: raise ValueError('MusicBrainz response does not match the selected release ID')
    if not is_cd(release): raise ValueError('Selected edition does not declare CD media')
    if expected_barcode and release.get('barcode') != clean_barcode(expected_barcode):
        raise ValueError('Selected edition does not have the confirmed complete barcode')
    manifest = {**release_summary(release),
                'fetchedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'images': [], 'discogs': [], 'errors': [], 'scope': 'edition reference; physical copy unconfirmed'}
    try:
        raw, _ = request(caa_url)
        art = json.loads(raw); (output / 'cover-art.json').write_bytes(raw)
        for entry in art.get('images', []):
            ident = str(entry['id'])
            if not ident.isdecimal(): raise ValueError('Invalid CAA image id')
            url = f'https://coverartarchive.org/release/{rid}/{ident}.jpg'
            item = {'id': ident, 'sourceId': 'caa:' + ident, 'provider': 'CAA',
                    'types': entry.get('types', []), 'comment': entry.get('comment', ''),
                    'approved': entry.get('approved'), 'sourceUrl': url}
            download_image(item, output, ident, manifest)
    except (OSError, ValueError) as error:
        manifest['errors'].append({'scope': 'cover-art-list', 'error': str(error)})
    for discogs_id in discogs_release_ids(release):
        url = f'https://api.discogs.com/releases/{discogs_id}'
        item = {'releaseId': discogs_id, 'sourceUrl': url}
        try:
            raw, _ = request(url)
            reference = json.loads(raw); (output / f'discogs-{discogs_id}.json').write_bytes(raw)
            verified = verify_discogs(release, reference)
            if str(reference.get('id')) != discogs_id or not verified:
                item['status'] = 'identity-mismatch'
                manifest['errors'].append({'scope': f'discogs:{discogs_id}', 'error': 'Full barcode/catalog/CD identity did not match; reference art excluded'})
            else:
                item.update(status='identity-verified', formats=reference.get('formats', []), notes=reference.get('notes', ''),
                            labels=reference.get('labels', []), identifiers=reference.get('identifiers', []))
                for index, image in enumerate(reference.get('images', [])):
                    source_url = image.get('uri')
                    if not source_url: continue
                    source = {'sourceId': f'discogs:{discogs_id}:{index}', 'provider': 'Discogs', 'types': [],
                              'catalogImageType': image.get('type', ''), 'sourceUrl': source_url,
                              'declaredPixels': [image.get('width'), image.get('height')]}
                    download_image(source, output, f'discogs-{discogs_id}-{index}', manifest)
        except (OSError, ValueError) as error:
            item.update(status='failed', error=str(error)); manifest['errors'].append({'scope': f'discogs:{discogs_id}', 'error': str(error)})
        manifest['discogs'].append(item)
    roles = {role for entry in manifest['images'] if entry['status'] == 'downloaded' for role in entry.get('types', [])}
    manifest['absentRoles'] = sorted({'Front', 'Back', 'Spine', 'Booklet', 'Tray', 'Medium'} - roles)
    manifest['roleEvidence'] = 'CAA role labels only; inspect structures before assigning any model surface'
    manifest['status'] = 'partial' if manifest['errors'] else 'retrieved'
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('release', type=release_id, nargs='?', help='User-confirmed MusicBrainz release URL or MBID')
    parser.add_argument('--barcode', help='Complete barcode: candidates first, or recheck a selected release')
    parser.add_argument('--confirmed', action='store_true', help='The user explicitly confirmed this selected edition')
    parser.add_argument('--output', type=Path, help='A new directory for confirmed-edition reference originals')
    args = parser.parse_args()
    if not args.release:
        if not args.barcode: parser.error('Start with --barcode; fetch the selected release after user confirmation')
        if args.confirmed or args.output: parser.error('Barcode candidate mode prints JSON only; no --confirmed or --output')
        try: result = find_candidates(args.barcode)
        except (OSError, ValueError) as error: parser.exit(1, f'Failed: {error}\n')
        print(json.dumps(result, ensure_ascii=False, indent=2)); return 0
    if not args.confirmed or not args.output: parser.error('Selected release fetching requires --confirmed and a new --output directory')
    try:
        manifest = fetch(args.release, args.output, expected_barcode=args.barcode)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Failed: {error}\n')
    print(json.dumps({'title': manifest['title'], 'status': manifest['status'],
                      'downloaded': sum(i['status'] == 'downloaded' for i in manifest['images']),
                      'absentRoles': manifest['absentRoles'], 'manifest': str(args.output / 'manifest.json')}, ensure_ascii=False))
    return 1 if manifest['errors'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
