"""精确条形码入口回归测试：非法码拒绝、同码过滤、多个版次保留。"""
import unittest
from types import SimpleNamespace
from unittest.mock import Mock

from domain import ValidationError
from server.routes import GET, POST, api_barcode_lookup, api_release_artwork, api_release_front_cover


class BarcodeLookupTests(unittest.TestCase):
    def setUp(self):
        self.http = SimpleNamespace(send=Mock())
        self.vision = SimpleNamespace(catalog=Mock(return_value=[]), fallback=Mock(return_value=[]))
        self.service = SimpleNamespace(releases=self.vision)

    def test_only_valid_numeric_barcodes_query_catalog(self):
        for value in ('', '123', '123456789012345', '987-123456', '12345abc', '123456789', '12345678'):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                api_barcode_lookup(self.http, self.service, {'barcode': value})
        self.vision.catalog.assert_not_called()
        self.assertIn('/api/catalog/barcode', POST)
        self.assertEqual(POST['/api/catalog/barcode'][1:], (True, False))

    def test_exact_barcode_filter_retains_all_exact_cd_editions(self):
        def candidate(barcode, matched=True):
            return {'id': barcode, 'identifierMatch': matched, 'releaseInfo': {'barcode': barcode}}
        self.vision.catalog.return_value = [
            candidate('4988013047105'), candidate('4988013047105'),
            candidate('4006381333931'), candidate('4988013047105', False)]
        api_barcode_lookup(self.http, self.service, {'barcode': ' 4988013047105 '})
        self.vision.catalog.assert_called_once_with({
            'title': '', 'artist': '', 'releaseInfo': {'barcode': '4988013047105', 'catalogNumber': ''}})
        self.vision.fallback.assert_not_called()
        response = self.http.send.call_args.args[0]
        self.assertEqual(response['barcode'], '4988013047105')
        self.assertEqual(len(response['candidates']), 2)

    def test_no_match_returns_empty_candidates_without_guessing(self):
        api_barcode_lookup(self.http, self.service, {'barcode': '96385074'})
        self.http.send.assert_called_once_with({'barcode': '96385074', 'candidates': [],
            'sources': {'musicbrainz': 'none', 'discogs': 'none'}})

    def test_musicbrainz_miss_falls_back_to_discogs_candidates(self):
        found = {'id': 'discogs-7714607', 'source': 'discogs', 'identifierMatch': True,
                 'releaseInfo': {'barcode': '4582213912173'}}
        self.vision.fallback.return_value = [found]
        api_barcode_lookup(self.http, self.service, {'barcode': '4582213912173'})
        self.vision.fallback.assert_called_once_with('4582213912173', '')
        response = self.http.send.call_args.args[0]
        self.assertEqual(response['candidates'], [found])
        self.assertEqual(response['sources'], {'musicbrainz': 'none', 'discogs': 'found'})

    def test_one_source_down_still_answers_but_both_down_reports_error(self):
        self.vision.catalog.side_effect = ValidationError('发行资料库暂时不可用，请稍后重试')
        api_barcode_lookup(self.http, self.service, {'barcode': '4582213912173'})
        self.assertEqual(self.http.send.call_args.args[0]['sources']['discogs'], 'none')
        self.vision.fallback.side_effect = ValidationError('无法连接 Discogs 或请求超时')
        with self.assertRaises(ValidationError): api_barcode_lookup(self.http, self.service, {'barcode': '4582213912173'})


class HedgedLookupTests(unittest.TestCase):
    def test_slow_musicbrainz_does_not_delay_discogs(self):
        import threading
        from server.routes import lookup_sources
        discogs_started = threading.Event()
        def slow_catalog(fields):
            self.assertTrue(discogs_started.wait(2), 'Discogs 应在 MusicBrainz 仍在等待时并行启动')
            return []
        def discogs(barcode, catno):
            discogs_started.set()
            return [{'id': 'discogs-1', 'identifierMatch': True, 'releaseInfo': {}}]
        service = SimpleNamespace(releases=SimpleNamespace(catalog=slow_catalog, fallback=discogs))
        candidates, sources = lookup_sources(service, '4582213912173', '', lambda found: found, hedge=0.05)
        self.assertEqual([c['id'] for c in candidates], ['discogs-1'])
        self.assertEqual(sources, {'musicbrainz': 'none', 'discogs': 'found'})


class ConfirmedReleaseArtTests(unittest.TestCase):
    EDITION = '11111111-1111-4111-8111-111111111111'

    def setUp(self):
        self.http = SimpleNamespace(path='/api/catalog/artwork?id=' + self.EDITION, send=Mock())
        self.art = SimpleNamespace(catalog=Mock(return_value={'images': [
            {'id': 123, 'types': ['Front'], 'thumbnails': {'small': 'https://archive.org/front.jpg'}},
            {'id': 234, 'types': ['Booklet'], 'thumbnails': {'small': 'https://archive.org/inside.jpg'}}
        ]}), image=Mock(return_value=b'\x89PNG\r\n\x1a\nvalid'))
        self.service = SimpleNamespace(twins=SimpleNamespace(art=self.art))

    def test_artwork_only_uses_selected_release_id(self):
        self.assertIn('/api/catalog/artwork', GET)
        api_release_artwork(self.http, self.service)
        self.art.catalog.assert_called_once_with(self.EDITION)
        result = self.http.send.call_args.args[0]
        self.assertEqual([a['types'] for a in result['artwork']], [['Front'], ['Booklet']])
        self.http.path = '/api/catalog/artwork?id=malformed'
        with self.assertRaises(ValidationError): api_release_artwork(self.http, self.service)
        self.art.catalog.assert_called_once_with(self.EDITION)

    def test_front_cover_requires_same_release_and_front_image(self):
        self.assertIn('/api/catalog/front-cover', GET)
        self.http.path = '/api/catalog/front-cover?id=' + self.EDITION
        api_release_front_cover(self.http, self.service)
        self.art.image.assert_called_once_with(self.EDITION, '123', preview=True)
        cover = self.http.send.call_args.args[0]['cover']
        self.assertTrue(cover.startswith('data:image/png;base64,'))
        self.art.catalog.return_value = {'images': [{'id': 234, 'types': ['Booklet']}]}
        api_release_front_cover(self.http, self.service)
        self.assertEqual(self.http.send.call_args.args[0]['cover'], '')
        self.art.image.assert_called_once()


if __name__ == '__main__':
    unittest.main()
