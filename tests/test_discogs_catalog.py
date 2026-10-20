"""Discogs 备用来源：精确标识匹配、CD 过滤、详情映射、限流冷却；响应均为固定夹具，不连网。"""
import json
import unittest
from io import BytesIO
from urllib.error import HTTPError

from domain import ValidationError
from server.discogs_catalog import DiscogsCatalog

SEARCH = {'results': [
    {'id': 7714607, 'type': 'release', 'title': 'King Crimson - Red', 'catno': 'IECP-50008', 'country': 'Japan',
     'year': '2008', 'format': ['CD', 'HDCD', 'Album', 'Limited Edition', 'Reissue'], 'format_quantity': 1,
     'barcode': ['4 582213 912173'], 'label': ['Discipline Global Mobile', 'Robert Fripp']},
    {'id': 2, 'type': 'release', 'title': 'King Crimson - Red', 'format': ['Vinyl'], 'barcode': ['4582213912173']},
    {'id': 3, 'type': 'release', 'title': 'Other - Thing', 'format': ['CD'], 'barcode': ['999'], 'catno': 'X-1'}]}
RELEASE = {'id': 7714607, 'country': 'Japan', 'released': '2008-03-26', 'formats': [{'name': 'CD', 'qty': '1', 'descriptions': ['HDCD', 'Reissue']}],
           'labels': [{'name': 'Discipline Global Mobile', 'catno': 'IECP-50008'}], 'identifiers': [{'type': 'Barcode', 'value': '4582213912173'}],
           'tracklist': [{'position': '1', 'title': 'Red', 'duration': '4:12', 'type_': 'track'},
                         {'position': '2', 'title': 'Fallen Angel', 'duration': '', 'type_': 'track'}]}


class FakeOpener:
    def __init__(self, *bodies): self.bodies, self.urls = list(bodies), []
    def open(self, request, timeout=None):
        self.urls.append(request.full_url)
        body = self.bodies.pop(0)
        if isinstance(body, int): raise HTTPError(request.full_url, body, 'x', {}, BytesIO())
        return BytesIO(json.dumps(body).encode())


def catalog(*bodies):
    opener = FakeOpener(*bodies)
    return DiscogsCatalog(opener=opener, sleep=lambda s: None, clock=lambda: 0.0), opener


class DiscogsCatalogTests(unittest.TestCase):
    def test_barcode_search_keeps_only_exact_cd_matches(self):
        service, opener = catalog(SEARCH)
        found = service.search(barcode='4582213912173')
        self.assertIn('barcode=4582213912173', opener.urls[0])
        self.assertEqual([c['id'] for c in found], ['discogs-7714607'])
        c = found[0]
        self.assertEqual((c['title'], c['artist'], c['source']), ('Red', 'King Crimson', 'discogs'))
        self.assertEqual((c['releaseInfo']['catalogNumber'], c['releaseInfo']['country'], c['releaseInfo']['discogsReleaseId']),
                         ('IECP-50008', 'JP', '7714607'))
        self.assertEqual(c['releaseInfo']['barcode'], '4582213912173')

    def test_catalog_number_search_ignores_punctuation_and_case(self):
        service, _ = catalog(SEARCH)
        self.assertEqual(len(service.search(catno='iecp50008')), 1)

    def test_release_details_map_tracks_and_identity(self):
        service, _ = catalog(RELEASE)
        info = service.release_details('discogs-7714607')
        self.assertEqual(info['barcode'], '4582213912173')
        self.assertEqual(info['tracklist'], ['1-1 Red', '1-2 Fallen Angel'])
        self.assertEqual(info['media'][0]['tracks'][0]['lengthMs'], 252000)
        self.assertNotIn('lengthMs', info['media'][0]['tracks'][1])
        with self.assertRaises(ValidationError): service.release_details('discogs-abc')

    def test_non_cd_release_rejected(self):
        service, _ = catalog(dict(RELEASE, formats=[{'name': 'Vinyl'}]))
        with self.assertRaises(ValidationError): service.release_details('discogs-7714607')

    def test_rate_limit_enters_cooldown_without_more_requests(self):
        service, opener = catalog(429)
        with self.assertRaises(ValidationError): service.search(barcode='4582213912173')
        with self.assertRaises(ValidationError): service.search(barcode='4988013047105')
        self.assertEqual(len(opener.urls), 1)


if __name__ == '__main__':
    unittest.main()
