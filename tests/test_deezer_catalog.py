"""Deezer 条码备用来源：UPC/JAN 精确匹配、数字发行语义、详情映射与限流；夹具不连网。"""
import json
import unittest
from io import BytesIO
from urllib.error import HTTPError

from domain import ValidationError
from server.deezer_catalog import DeezerCatalog

ALBUM = {'id': 123, 'title': 'Red', 'upc': '4582213912173', 'label': 'Discipline Global Mobile',
         'release_date': '2008-03-26', 'artist': {'name': 'King Crimson'},
         'cover_xl': 'https://cdn-images.deezer.com/images/cover/1.jpg',
         'cover_medium': 'https://cdn-images.deezer.com/images/cover/2.jpg',
         'nb_tracks': 2,
         'tracks': {'data': [
             {'title': 'Red', 'duration': 252, 'disk_number': 1, 'track_position': 1},
             {'title': 'Fallen Angel', 'duration': 240, 'disk_number': 1, 'track_position': 2}]}}


class FakeOpener:
    def __init__(self, *bodies): self.bodies, self.urls = list(bodies), []
    def open(self, request, timeout=None):
        self.urls.append(request.full_url)
        body = self.bodies.pop(0)
        if isinstance(body, int): raise HTTPError(request.full_url, body, 'x', {}, BytesIO())
        return BytesIO(json.dumps(body).encode())


def catalog(*bodies):
    opener = FakeOpener(*bodies)
    return DeezerCatalog(opener=opener, sleep=lambda s: None, clock=lambda: 0.0), opener


class DeezerCatalogTests(unittest.TestCase):
    def test_barcode_search_returns_digital_release_without_inventing_cd(self):
        service, opener = catalog(ALBUM)
        found = service.search(barcode='4582213912173')
        self.assertIn('album/upc:4582213912173', opener.urls[0])
        self.assertEqual([c['id'] for c in found], ['deezer-123'])
        c = found[0]
        self.assertEqual((c['title'], c['artist'], c['source']), ('Red', 'King Crimson', 'deezer'))
        self.assertEqual(c['releaseInfo']['barcode'], '4582213912173')
        self.assertEqual(c['releaseInfo']['deezerId'], '123')
        self.assertEqual(c['releaseInfo']['format'], '')       # 数字发行，不写 CD
        self.assertEqual(c['releaseInfo']['discCount'], '')
        self.assertTrue(c['url'].startswith('https://www.deezer.com/album/'))
        self.assertTrue(c['cover'].startswith('https://'))

    def test_upc_a_and_ean_13_are_the_same_code(self):
        service, opener = catalog(ALBUM)
        found = service.search(barcode='04582213912173')
        self.assertEqual([c['id'] for c in found], ['deezer-123'])
        self.assertEqual(len(opener.urls), 1)

    def test_other_barcode_or_catalog_number_returns_empty(self):
        service, opener = catalog(dict(ALBUM, upc='4988013047105'))
        self.assertEqual(service.search(barcode='4988013047106'), [])
        self.assertEqual(len(opener.urls), 1)
        self.assertEqual(service.search(catno='IECP-50008'), [])
        self.assertEqual(len(opener.urls), 1)

    def test_release_details_map_tracks_and_identity(self):
        service, opener = catalog(ALBUM)
        info = service.release_details('deezer-123')
        self.assertEqual(info['barcode'], '4582213912173')
        self.assertEqual(info['tracklist'], ['1-1 Red', '1-2 Fallen Angel'])
        self.assertEqual(info['media'][0]['tracks'][0]['lengthMs'], 252000)
        self.assertEqual(info['deezerId'], '123')
        self.assertEqual(len(opener.urls), 1)   # 曲目已够，不再拉 tracks
        with self.assertRaises(ValidationError): service.release_details('deezer-abc')

    def test_api_error_object_is_treated_as_no_match(self):
        service, _ = catalog({'error': {'type': 'DataException', 'message': 'no album'}})
        self.assertEqual(service.search(barcode='4582213912173'), [])

    def test_rate_limit_enters_cooldown_without_more_requests(self):
        service, opener = catalog(429)
        with self.assertRaises(ValidationError): service.search(barcode='4582213912173')
        with self.assertRaises(ValidationError): service.search(barcode='4988013047105')
        self.assertEqual(len(opener.urls), 1)


if __name__ == '__main__':
    unittest.main()
