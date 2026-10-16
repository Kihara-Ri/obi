"""Typed source boundary: verified releases, CAA, Discogs and immutable image evidence.

No model API or 3D geometry logic is allowed in this module.
"""
import base64
import json
import re
import unicodedata
from dataclasses import dataclass
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError

from .errors import ValidationError
from .contracts import UUID, clean_barcode, image_type
from .errors import SourceUnavailable, BadSource
from .artwork import compatible_release, image_coverage, has_sufficient_exact_art
from .errors import NeedsInput, Stopped, ArtNotFound

class ArtRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urlsplit(newurl)
        if parsed.scheme != 'https' or parsed.username or parsed.password or not (
            parsed.hostname in ('coverartarchive.org', 'archive.org') or (parsed.hostname or '').endswith('.archive.org')):
            raise ValidationError('图集来源返回了不支持的跳转')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class ArtClient:
    def __init__(self, opener_factory=None):
        self.opener_factory = opener_factory or build_opener

    def read(self, url, limit):
        try:
            with self.opener_factory(ArtRedirect()).open(Request(url, headers={'User-Agent': 'Diedu/2.4 (CD entity artwork)'}), timeout=35) as response:
                raw = response.read(limit + 1)
            if len(raw) > limit: raise ValidationError('实物图集资源过大')
            return raw
        except HTTPError as exc:
            if exc.code == 404: raise ArtNotFound('这一发行版本还没有实物图集') from None
            raise ValidationError('实物图集暂时无法获取，请稍后重试') from None
        except (URLError, TimeoutError, OSError):
            raise ValidationError('实物图集暂时无法获取，请稍后重试') from None

    def catalog(self, edition):
        try:
            catalog = json.loads(self.read('https://coverartarchive.org/release/' + edition, 2 * 1024 * 1024))
            if not isinstance(catalog, dict) or not isinstance(catalog.get('images'), list): raise ValueError()
            return catalog
        except (ValueError, UnicodeError): raise ValidationError('实物图集返回了无效资料') from None

    def image(self, edition, ident, preview=False):
        suffix = '-1200.jpg' if preview else '.jpg'
        return self.read(f'https://coverartarchive.org/release/{edition}/{ident}{suffix}', 24 * 1024 * 1024)


def discogs_image_url(value):
    if not isinstance(value, str) or not value or len(value) > 2048: return False
    try:
        parsed = urlsplit(value)
        return (parsed.scheme == 'https' and parsed.hostname == 'i.discogs.com' and parsed.port in (None, 443)
                and not parsed.username and not parsed.password and bool(parsed.path) and not parsed.fragment)
    except ValueError: return False


class DiscogsRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Image requests never leave the image host, and metadata never leaves the API.
        old = urlsplit(req.full_url); new = urlsplit(newurl)
        try: valid = new.scheme == 'https' and new.hostname == old.hostname and new.port in (None, 443) and not new.username and not new.password
        except ValueError: valid = False
        if not valid: raise ValidationError('Discogs 来源返回了不支持的跳转')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class DiscogsClient:
    def __init__(self, opener_factory=None):
        self.opener_factory = opener_factory or build_opener

    def read(self, url, limit):
        try:
            with self.opener_factory(DiscogsRedirect()).open(Request(url, headers={'User-Agent': 'Diedu/2.4 (CD entity artwork)'}), timeout=35) as response:
                raw = response.read(limit + 1)
            if len(raw) > limit: raise ValidationError('Discogs 来源资源过大')
            return raw
        except HTTPError as exc:
            if exc.code == 404: raise ArtNotFound('这一 Discogs 发行版不存在') from None
            raise ValidationError('Discogs 同版资料暂时无法获取') from None
        except (URLError, TimeoutError, OSError): raise ValidationError('Discogs 同版资料暂时无法获取') from None

    def release(self, ident):
        if not isinstance(ident, str) or not re.fullmatch(r'[1-9][0-9]{0,9}', ident): raise ValidationError('Discogs 发行版编号无效')
        try:
            result = json.loads(self.read('https://api.discogs.com/releases/' + ident, 2 * 1024 * 1024))
            if (not isinstance(result, dict) or type(result.get('id')) is not int or str(result['id']) != ident
                    or any(not isinstance(result.get(key, []), list) for key in ('identifiers', 'labels', 'formats', 'images'))):
                raise ValueError()
            return result
        except (ValueError, UnicodeError): raise ValidationError('Discogs 来源返回了无效发行资料') from None

    def image(self, url):
        if not discogs_image_url(url): raise ValidationError('Discogs 图片来源无效')
        return self.read(url, 24 * 1024 * 1024)


@dataclass(frozen=True)
class SourceManifest:
    context: dict
    sources: dict
    catalog_ids: dict
    related_ids: dict
    reference_ids: dict
    edition: str

    @property
    def allowed_ids(self):
        return (frozenset(self.sources)
                | frozenset('caa:' + key for key in self.catalog_ids)
                | frozenset(self.related_ids)
                | frozenset(self.reference_ids))


class SourceDiscovery:
    def __init__(self, store, mb, art, discogs):
        self.store, self.mb, self.art, self.discogs = store, mb, art, discogs

    @staticmethod
    def _barcode(value):
        try: return clean_barcode(value)
        except ValidationError: return ''

    @staticmethod
    def release_summary(release):
        media = release.get('media', [])
        labels = release.get('label-info', [])
        return {'id': release['id'], 'title': str(release.get('title', '')),
                'artist': ''.join(c.get('name', '') + c.get('joinphrase', '') for c in release.get('artist-credit', []) if isinstance(c, dict)),
                'date': str(release.get('date', '')), 'country': str(release.get('country', '')),
                'barcode': str(release.get('barcode', '')), 'edition': str(release.get('disambiguation', '')),
                'packaging': release.get('packaging'),
                'catalogNumber': ' / '.join(dict.fromkeys(str(i['catalog-number']) for i in labels if i.get('catalog-number'))),
                'label': ' / '.join(dict.fromkeys(str(i.get('label', {}).get('name', '')) for i in labels if i.get('label', {}).get('name'))),
                'discCount': len(media), 'url': 'https://musicbrainz.org/release/' + release['id'],
                'media': [{'position': m.get('position', n + 1), 'format': str(m.get('format', '')),
                           'tracks': [{'position': t.get('position', i + 1), 'title': str(t.get('title') or t.get('recording', {}).get('title', '')),
                                       'length': t.get('length')} for i, t in enumerate(m.get('tracks', []))]} for n, m in enumerate(media)]}

    def review_artwork(self, job, edition, step):
        try: catalog = self.art.catalog(edition)
        except ArtNotFound: return [], 'missing', {}
        except ValidationError: return [], 'unavailable', {}
        images = [image for image in catalog.get('images', []) if str(image.get('id', '')).isdigit()][:40]
        artwork = [{'id': str(i['id']), 'types': i.get('types', []), 'comment': str(i.get('comment', '')),
                    'previewStatus': 'not_loaded'} for i in images]
        priority = lambda item: min(({'Front': 0, 'Back': 1, 'Spine': 2, 'Medium': 3, 'Tray': 4, 'Booklet': 5}.get(t, 6) for t in item['types']), default=6)
        for image in sorted(artwork, key=priority)[:16]:
            step('fetching_review', '正在获取发行版本的图集预览')
            try:
                raw = self.art.image(edition, image['id'], preview=True)
                ext, _ = image_type(raw)
            except ValidationError:
                image['previewStatus'] = 'unavailable'; continue
            name = 'preview-' + image['id'] + '.' + ext
            self.store.write_twin_source(job['id'], job['claim'], name, raw)
            image.update(previewStatus='available', previewAsset=name, previewUrl=self.store.review_asset_url(job['id'], name))
        return artwork, 'available' if artwork else 'missing', catalog

    def review_discogs(self, release, barcode, step):
        """Follow only this exact MB edition's release relation, with two identifiers."""
        linked = set()
        for relation in release.get('relations', []):
            if not isinstance(relation, dict) or relation.get('type') != 'discogs': continue
            url = relation.get('url', {}).get('resource') if isinstance(relation.get('url'), dict) else None
            if not isinstance(url, str): continue
            try:
                parsed = urlsplit(url)
                if (parsed.scheme not in ('http', 'https') or parsed.hostname not in ('discogs.com', 'www.discogs.com')
                        or parsed.username or parsed.password or parsed.port not in (None, 80, 443) or parsed.query or parsed.fragment): continue
            except ValueError: continue
            match = re.fullmatch(r'/release/([1-9][0-9]{0,9})(?:-[^/]+)?/?', parsed.path)
            if match: linked.add(match[1])
        if not linked: return []
        if len(linked) != 1: return [{'origin': 'discogs', 'status': 'ambiguous'}]
        ident = next(iter(linked)); evidence = {'origin': 'discogs', 'id': ident, 'url': 'https://www.discogs.com/release/' + ident}
        step('fetching_review', '正在核对同一发行版的 Discogs 条形码与目录号')
        try: data = self.discogs.release(ident)
        except ArtNotFound: return [evidence | {'status': 'missing'}]
        except ValidationError: return [evidence | {'status': 'unavailable'}]
        numbers = {self._barcode(i.get('value')) for i in data.get('identifiers', [])
                   if isinstance(i, dict) and i.get('type') == 'Barcode'} - {''}
        normalize = lambda n: re.sub(r'\s+', '', unicodedata.normalize('NFKC', n)).upper() if isinstance(n, str) else ''
        expected = {normalize(i.get('catalog-number')) for i in release.get('label-info', []) if isinstance(i, dict)} - {''}
        catalogs = {normalize(i.get('catno')) for i in data.get('labels', []) if isinstance(i, dict)} - {''}
        if (str(data.get('id')) != ident or barcode not in numbers or not expected.intersection(catalogs)
                or not any(isinstance(f, dict) and f.get('name') == 'CD' for f in data.get('formats', []))):
            return [evidence | {'status': 'mismatched'}]
        images = []
        for index, image in enumerate(data.get('images', [])[:40]):
            if not isinstance(image, dict) or not discogs_image_url(image.get('uri')): continue
            entry = {'sourceId': f'discogs:{ident}:{index}', 'url': image['uri'], 'type': str(image.get('type', ''))[:50]}
            for dimension in ('width', 'height'):
                if type(image.get(dimension)) is int and 0 < image[dimension] <= 50000: entry[dimension] = image[dimension]
            images.append(entry)
        return [evidence | {'status': 'verified', 'title': str(data.get('title', ''))[:1000],
                            'barcode': barcode, 'catalogNumbers': sorted(expected.intersection(catalogs)),
                            'notes': str(data.get('notes', ''))[:16000], 'images': images}]

    def related_artwork(self, release, archive, references, step):
        """Find better art *inside the same release group* with equal sleeve and CD count.

        Do not replace release identity or query by fuzzy album name. Confirmed
        same-edition photos (especially Discogs) always take precedence.
        """
        if has_sufficient_exact_art(archive, references):
            return []
        group = release.get('release-group')
        group_id = group.get('id') if isinstance(group, dict) else None
        media = release.get('media', [])
        if (not isinstance(group_id, str) or not UUID.fullmatch(group_id)
                or not isinstance(media, list) or not media
                or not all(isinstance(m, dict) and 'CD' in str(m.get('format', '')).upper() for m in media)):
            return []
        candidates = []
        try:
            response = self.mb.get('release', {'fmt': 'json', 'release-group': group_id, 'limit': 30})
            if not isinstance(response, dict) or response.get('release-count', 0) > 30:
                return []
            for item in response.get('releases', [])[:8]:
                ident = item.get('id') if isinstance(item, dict) else None
                if not isinstance(ident, str) or not UUID.fullmatch(ident) or ident == release['id']:
                    continue
                # The release browse response does not reliably include medium
                # or packaging; fetch only a small, bounded candidate set.
                detail = self.mb.get('release/' + ident, {'fmt': 'json', 'inc': 'artist-credits+labels+recordings'})
                if detail.get('id') != ident or not compatible_release(detail, release, len(media)):
                    continue
                try:
                    catalog = self.art.catalog(ident)
                except (ArtNotFound, ValidationError):
                    continue
                images = [entry for entry in catalog.get('images', [])
                          if isinstance(entry, dict) and str(entry.get('id', '')).isdigit()][:40]
                if image_coverage(images)[0] < 2 or len(images) < 3:
                    continue
                candidates.append({
                    'releaseId': ident,
                    'releaseUrl': 'https://musicbrainz.org/release/' + ident,
                    'packaging': detail['packaging'], 'country': str(detail.get('country', '')),
                    'roleCoverage': image_coverage(images)[0], 'imageCount': len(images),
                    'images': [{'sourceId': f'related-caa:{ident}:{i["id"]}', 'types': i.get('types', []),
                                'comment': str(i.get('comment', ''))[:400]} for i in images],
                })
        except (SourceUnavailable, BadSource, ValidationError):
            return []  # Never block a valid original-edition workflow on secondary sources.
        # Image coverage is primary; country is a tiebreaker, not an identity shortcut.
        candidates.sort(key=lambda c: (c['roleCoverage'], c['imageCount'],
                                        int(c['country'] == release.get('country')), c['releaseId']), reverse=True)
        return candidates[:2]

    def lookup(self, job, step, barcode):
        # Barcode identification occurs upstream, outside this network adapter.
        source = 'record' if job.get('selectedReleaseId') else 'manual' if job.get('barcode') else 'photo'
        if not self.store.update_twin(job['id'], job['claim'], barcode=barcode, barcodeSource=source): raise Stopped()
        step('locating_release', '正在按完整条形码匹配 MusicBrainz CD 发行版本')
        selected = job.get('selectedReleaseId')
        if selected:
            # No second barcode search or edition selection: use the previously saved release UUID.
            items = [{'id': selected, 'barcode': barcode}]
        else:
            result = self.mb.get('release', {'fmt': 'json', 'query': 'barcode:"' + barcode + '"', 'limit': 20})
            if result.get('count', 0) > 20: raise NeedsInput('这个条形码对应超过 20 条发行资料，请核对副本的条形码数字', 'awaiting_barcode')
            items = result.get('releases', [])
        candidates = []; releases = {}; catalogs = {}
        for item in items:
            edition = item.get('id', '')
            if not isinstance(edition, str) or not UUID.fullmatch(edition) or self._barcode(item.get('barcode')) != barcode: continue
            step('locating_release', '正在获取对应版本的曲目与发行资料')
            release = self.mb.get('release/' + edition, {'fmt': 'json', 'inc': 'artist-credits+labels+recordings+url-rels'})
            media = release.get('media', [])
            if (release.get('id') != edition or self._barcode(release.get('barcode')) != barcode
                    or not 1 <= len(media) <= 4 or any('CD' not in str(m.get('format', '')) for m in media)): continue
            if edition in releases: continue
            summary = self.release_summary(release)
            artwork, status, catalog = self.review_artwork(job, edition, step)
            references = self.review_discogs(release, barcode, step)
            related = self.related_artwork(release, catalog, references, step)
            summary.update(artwork=artwork, artworkStatus=status, editionReferences=references,
                           compatibleArtwork=related)
            catalog = {**catalog, 'editionReferences': references, 'compatibleArtwork': related}
            candidates.append(summary); releases[edition] = release; catalogs[edition] = catalog
        if not candidates:
            if selected: raise NeedsInput('已保存发行版本与条形码或 CD 介质不一致，请在上方重新选择发行版', 'awaiting_edition')
            raise NeedsInput('MusicBrainz 没有匹配到这一完整条形码的 CD 发行版本，请检查数字；不会按标题猜选其他版本', 'awaiting_barcode')
        return {'barcode': barcode, 'barcodeSource': source, 'candidates': candidates, 'releaseData': releases, 'artData': catalogs}

    def prepare(self, job, release, step, has_complete_local_faces):
        record = job['input']
        edition = job['releaseId']
        step('fetching_art', '正在读取同版实物图集')
        catalog = job.get('confirmedCatalog') or {}
        references = catalog.get('editionReferences', [])
        related_references = catalog.get('compatibleArtwork', [])
        related_ids = {image['sourceId']: (ref, image)
                       for ref in related_references for image in ref.get('images', [])}
        reference_ids = {image['sourceId']: image for reference in references if reference.get('status') == 'verified'
                         for image in reference.get('images', [])}
        reviewed = next((candidate for candidate in job.get('candidates', []) if candidate['id'] == edition), {})
        archive_status = reviewed.get('artworkStatus', 'missing')
        if archive_status == 'unavailable':
            step('fetching_art', '正在重新检查已确认发行版的实物图集')
            try:
                catalog = self.art.catalog(edition)
                archive_status = 'available' if catalog.get('images') else 'missing'
            except ArtNotFound: catalog = {}; archive_status = 'missing'
            except ValidationError:
                if not reference_ids and not has_complete_local_faces:
                    raise NeedsInput('同版实物图集仍暂时无法获取，尚未调用生成模型；请稍后重试，或补充并确认正反面、内页及盘面照片', 'source_unavailable') from None
        images = [i for i in catalog.get('images', []) if str(i.get('id', '')).isdigit()][:40]
        catalog_ids = {str(i['id']): i for i in images}
        sources = dict(job['sources'])
        if not sources and not images and not reference_ids and not related_ids: raise NeedsInput('这张专辑没有同版或同封装的可用图集，请保存实物照片后重试')
        context = {'record': record, 'release': release,
                   'recordSources': list(sources),
                   'archiveImages': [{'id': str(i['id']), 'types': i.get('types', []),
                                      'comment': i.get('comment', '')} for i in images],
                   'archiveStatus': archive_status, 'editionReferences': references,
                   'compatibleArtwork': related_references}
        return SourceManifest(context, sources, catalog_ids, related_ids, reference_ids, edition)

    def fetch_images(self, job, manifest, chosen, step):
        sources = manifest.sources.copy()
        catalog_ids = manifest.catalog_ids
        related_ids = manifest.related_ids
        reference_ids = manifest.reference_ids
        edition = manifest.edition
        if any(source_id not in manifest.allowed_ids for source_id in chosen):
            raise ValidationError('agent 选择了图集中不存在的素材')
        visuals = []
        for number, source_id in enumerate(chosen):
            step('fetching_art', f'正在获取实物图（{number + 1}/{len(chosen)}）')
            if source_id in sources:
                source = sources[source_id]; raw = self.store.twin_source(job['id'], source['asset']).read_bytes()
                preview = raw
            elif source_id.startswith('caa:') and source_id[4:] in catalog_ids:
                ident = source_id[4:]; raw = self.art.image(edition, ident); ext, mime = image_type(raw)
                name = 'caa-' + ident + '.' + ext
                self.store.write_twin_source(job['id'], job['claim'], name, raw)
                source = {'asset': name, 'mime': mime, 'origin': 'edition-reference',
                          'sourceUrl': f'https://coverartarchive.org/release/{edition}/{ident}.jpg'}
                sources[source_id] = source
                preview = self.art.image(edition, ident, preview=True)
            elif source_id in related_ids:
                reference, entry = related_ids[source_id]
                rel_id = reference['releaseId']; ident = source_id.split(':')[-1]
                raw = self.art.image(rel_id, ident); ext, mime = image_type(raw)
                name = 'caa-' + ident + '.' + ext
                self.store.write_twin_source(job['id'], job['claim'], name, raw)
                source = {'asset': name, 'mime': mime, 'origin': 'compatible-edition-reference',
                          'sourceReleaseId': rel_id,
                          'sourceUrl': f'https://coverartarchive.org/release/{rel_id}/{ident}.jpg'}
                sources[source_id] = source
                try: preview = self.art.image(rel_id, ident, preview=True)
                except ValidationError: preview = raw
            elif source_id in reference_ids:
                image = reference_ids[source_id]; raw = self.discogs.image(image['url']); ext, mime = image_type(raw)
                _, ident, index = source_id.split(':'); name = f'discogs-{ident}-{index}.' + ext
                self.store.write_twin_source(job['id'], job['claim'], name, raw)
                source = {'asset': name, 'mime': mime, 'origin': 'edition-reference', 'sourceUrl': image['url']}
                sources[source_id] = source; preview = raw
            else: raise ValidationError('agent 选择了图集中不存在的素材')
            ext, mime = image_type(preview)
            visuals.append('data:' + mime + ';base64,' + base64.b64encode(preview).decode())
        return sources, visuals
