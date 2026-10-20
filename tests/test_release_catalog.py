"""发行版目录服务：按条码 / 唱片编号检索 CD 发行版本，读取发行版详情（MusicBrainz 响应用固定夹具）。"""
import unittest
from unittest.mock import patch

from domain import ValidationError
from server.release_catalog import ReleaseCatalog, display_release_title

FIELDS = {'title': '', 'artist': '', 'releaseInfo': {'barcode': '1234567890123', 'catalogNumber': 'TEST-002'}}


class ReleaseCatalogTests(unittest.TestCase):
    def setUp(self):
        self.service = ReleaseCatalog()

    def test_release_candidates_use_physical_identifiers_and_filter_vinyl(self):
        self.service.catalog_at = 0
        releases = {'releases': [{'id': '11111111-1111-1111-1111-111111111111', 'title': 'Fixture Album', 'barcode': '1234567890123',
            'artist-credit': [{'name': 'Fixture Artist'}], 'country': 'JP', 'date': '2001-02-03', 'media': [{'format': 'CD'}],
            'label-info': [{'catalog-number': 'TEST-002', 'label': {'name': 'Fixture Label'}}]},
            {'id': '22222222-2222-2222-2222-222222222222', 'media': [{'format': 'Vinyl'}]}]}
        with patch('server.release_catalog.read_json', return_value=releases) as request:
            candidates = self.service.catalog(FIELDS)
        self.assertEqual(len(candidates), 1)
        self.assertTrue(candidates[0]['identifierMatch'])
        self.assertIn('barcode', request.call_args.args[0])
        self.assertEqual(candidates[0]['releaseInfo']['country'], 'JP')

    def test_short_musicbrainz_rate_limit_is_retried_once(self):
        from musicbrainz import RateLimited
        calls = []
        class Client:
            def get_url(self, url):
                calls.append(url)
                if len(calls) == 1: raise RateLimited('限流')
                return {'releases': []}
            def cooldown_remaining(self): return 0.01
        service = ReleaseCatalog(mb=Client())
        self.assertEqual(service.catalog(FIELDS), [])
        self.assertEqual(len(calls), 2)

    def test_long_musicbrainz_cooldown_is_not_waited_for(self):
        from musicbrainz import RateLimited
        class Client:
            def get_url(self, url): raise RateLimited('限流')
            def cooldown_remaining(self): return 30
        with self.assertRaises(ValidationError): ReleaseCatalog(mb=Client()).catalog(FIELDS)

    def test_release_detail_tracks_cache_and_cd_validation(self):
        ident = '11111111-1111-1111-1111-111111111111'
        release = {'barcode': '1234567890123', 'country': 'JP', 'date': '2001-02-03',
                   'label-info': [{'catalog-number': 'TEST-002', 'label': {'name': 'Fixture Label'}}],
                   'media': [{'format': 'CD', 'position': 1, 'title': 'Part I', 'tracks': [{'number': '1', 'title': 'First track', 'length': 241000}]},
                             {'format': 'CD', 'position': 2, 'tracks': [{'number': '1', 'recording': {'title': 'Second disc'}}]}]}
        with patch('server.release_catalog.read_json', return_value=release) as request:
            details = self.service.release_details(ident)
            self.assertEqual(details['tracklist'], ['1-1 First track', '2-1 Second disc'])
            self.assertEqual(details['discCount'], '2')
            self.assertEqual(details['catalogNumber'], 'TEST-002')
            self.assertEqual(details['media'][0]['title'], 'Part I')
            self.assertEqual(details['media'][0]['tracks'][0]['lengthMs'], 241000)
            self.assertEqual(details['media'][1]['tracks'][0]['position'], 1)
            self.assertEqual(self.service.release_details(ident), details)
            self.assertEqual(request.call_count, 1)
        with self.assertRaises(ValidationError):
            self.service.release_details('../outside')
        with patch('server.release_catalog.read_json', return_value={'media': [{'format': 'Vinyl'}]}):
            with self.assertRaisesRegex(ValidationError, 'CD'):
                self.service.release_details('22222222-2222-2222-2222-222222222222')

    def test_editorial_square_bracket_titles_are_unwrapped(self):
        self.assertEqual(display_release_title('[Untitled]'), 'Untitled')
        self.assertEqual(display_release_title('Real [Title]'), 'Real [Title]')


if __name__ == '__main__':
    unittest.main()
