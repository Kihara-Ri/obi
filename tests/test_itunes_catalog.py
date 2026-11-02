"""iTunes 条码备用来源：UPC/JAN 精确匹配、日本区优先、数字发行语义、详情映射、条码核对与限流；夹具不连网。"""
import json
import unittest
from io import BytesIO
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit

from domain import ValidationError
from server.itunes_catalog import ItunesCatalog
from server.release_catalog import ReleaseCatalog

ART = 'https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/45/c3/AVCA-29189.jpg/100x100bb.jpg'
COLLECTION = {'wrapperType': 'collection', 'collectionId': 1458696389, 'artistName': '門矢 士(CV.井上正大)',
              'collectionName': 'Ride the Wind - Single', 'artworkUrl100': ART, 'trackCount': 3,
              'copyright': '℗ 2009 AVEX ENTERTAINMENT INC.', 'releaseDate': '2009-04-22T07:00:00Z'}
TRACKS = [
    {'wrapperType': 'track', 'trackName': 'Ride the Wind instrumental', 'discNumber': 1, 'trackNumber': 3, 'trackTimeMillis': 213067},
    {'wrapperType': 'track', 'trackName': 'Ride the Wind', 'discNumber': 1, 'trackNumber': 1, 'trackTimeMillis': 213093},
    {'wrapperType': 'track', 'trackName': 'KAMEN RIDE POWER GUITAR EDIT.', 'discNumber': 1, 'trackNumber': 2, 'trackTimeMillis': 199093}]
JAN = '4988064291892'


def page(*results): return {'resultCount': len(results), 'results': list(results)}


class FakeOpener:
    def __init__(self, *bodies): self.bodies, self.urls = list(bodies), []
    def open(self, request, timeout=None):
        self.urls.append(request.full_url)
        body = self.bodies.pop(0)
        if isinstance(body, int): raise HTTPError(request.full_url, body, 'x', {}, BytesIO())
        return BytesIO(json.dumps(body).encode())


def catalog(*bodies):
    opener = FakeOpener(*bodies)
    return ItunesCatalog(opener=opener, sleep=lambda s: None, clock=lambda: 0.0), opener


def params(url): return {k: v[0] for k, v in parse_qs(urlsplit(url).query).items()}


class ItunesCatalogTests(unittest.TestCase):
    def test_barcode_search_returns_digital_release_without_inventing_cd(self):
        service, opener = catalog(page(COLLECTION))
        [c] = service.search(barcode=JAN)
        self.assertEqual(params(opener.urls[0]), {'upc': JAN, 'country': 'jp'})
        self.assertEqual((c['id'], c['source'], c['title'], c['artist']),
                         ('itunes-1458696389', 'itunes', 'Ride the Wind', '門矢 士(CV.井上正大)'))
        info = c['releaseInfo']
        self.assertEqual((info['barcode'], info['label'], info['releaseDate'], info['itunesId']),
                         (JAN, 'AVEX ENTERTAINMENT INC.', '2009-04-22', '1458696389'))
        # 数字发行：不写 CD、不填碟数；封面文件名里的编号也不当唱片编号用。
        self.assertEqual((info['format'], info['discCount'], info['catalogNumber']), ('', '', ''))
        self.assertTrue(c['identifierMatch'])
        self.assertTrue(c['cover'].endswith('/1200x1200bb.jpg'))
        self.assertTrue(c['coverSmall'].endswith('/300x300bb.jpg'))
        self.assertEqual(c['url'], 'https://music.apple.com/album/1458696389')

    def test_japan_miss_falls_back_to_us_store_and_results_are_cached(self):
        service, opener = catalog(page(), page(COLLECTION))
        self.assertEqual([c['id'] for c in service.search(barcode=JAN)], ['itunes-1458696389'])
        self.assertEqual([params(u)['country'] for u in opener.urls], ['jp', 'us'])
        service.search(barcode=JAN)
        self.assertEqual(len(opener.urls), 2)

    def test_no_catalog_number_lookup_and_bad_barcode_queries_nothing(self):
        service, opener = catalog()
        self.assertEqual(service.search(catno='AVCA-29189'), [])
        self.assertEqual(service.search(barcode='123'), [])
        self.assertEqual(opener.urls, [])

    def test_release_details_maps_ordered_tracks_and_lengths(self):
        service, opener = catalog(page(COLLECTION), page(COLLECTION, *TRACKS))
        service.search(barcode=JAN)
        info = service.release_details('itunes-1458696389')
        self.assertEqual(params(opener.urls[1])['entity'], 'song')
        self.assertEqual(info['tracklist'], ['1-1 Ride the Wind', '1-2 KAMEN RIDE POWER GUITAR EDIT.',
                                             '1-3 Ride the Wind instrumental'])
        self.assertEqual(info['media'][0]['tracks'][0], {'position': 1, 'title': 'Ride the Wind', 'lengthMs': 213093})
        self.assertEqual((info['barcode'], info['discCount'], info['format'], info['itunesId']), (JAN, '1', '', '1458696389'))
        with self.assertRaises(ValidationError): service.release_details('itunes-abc')

    def test_has_barcode_checks_by_exact_search(self):
        service, _ = catalog(page(COLLECTION), page(), page())
        self.assertTrue(service.has_barcode('itunes-1458696389', JAN))
        self.assertFalse(service.has_barcode('itunes-1458696389', '4006381333931'))

    def test_rate_limit_starts_cooldown(self):
        service, opener = catalog(403)
        with self.assertRaisesRegex(ValidationError, '限流'): service.search(barcode=JAN)
        with self.assertRaisesRegex(ValidationError, '冷却'): service.search(barcode='4006381333931')
        self.assertEqual(len(opener.urls), 1)


class Source:
    def __init__(self, result=None, error=None): self.result, self.error, self.calls = result or [], error, []
    def search(self, barcode='', catno=''):
        self.calls.append((barcode, catno))
        if self.error: raise ValidationError(self.error)
        return self.result


class BackupSourcesTests(unittest.TestCase):
    def test_barcode_lists_deezer_and_itunes_and_runs_neither_until_called(self):
        deezer, itunes, discogs = Source(), Source(), Source()
        jobs = ReleaseCatalog(deezer=deezer, itunes=itunes, discogs=discogs, ndl=Source()).backups(JAN)
        self.assertEqual([name for name, _ in jobs], ['deezer', 'itunes'])
        self.assertEqual((deezer.calls, itunes.calls), ([], []))
        [job() for _, job in jobs]
        self.assertEqual((deezer.calls, itunes.calls, discogs.calls), ([(JAN, '')], [(JAN, '')], []))

    def test_catalog_number_uses_discogs_and_ndl_only(self):
        itunes, discogs, ndl = Source(), Source(), Source()
        jobs = ReleaseCatalog(discogs=discogs, itunes=itunes, ndl=ndl).backups('', 'AVCA-29189')
        self.assertEqual([name for name, _ in jobs], ['discogs', 'ndl'])
        [job() for _, job in jobs]
        self.assertEqual((discogs.calls, ndl.calls, itunes.calls), ([('', 'AVCA-29189')], [('', 'AVCA-29189')], []))

    def test_unconfigured_sources_are_skipped(self):
        self.assertEqual(ReleaseCatalog().backups(JAN), [])

    def test_details_dispatch_to_itunes(self):
        itunes = Source(); itunes.release_details = lambda ident: {'itunesId': ident}
        self.assertEqual(ReleaseCatalog(itunes=itunes).release_details('itunes-7'), {'itunesId': 'itunes-7'})
        with self.assertRaisesRegex(ValidationError, '未启用'): ReleaseCatalog().release_details('itunes-7')


if __name__ == '__main__':
    unittest.main()
