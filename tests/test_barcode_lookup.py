"""精确条形码入口回归测试：非法码拒绝、同码过滤、多个版次保留。"""
import unittest
from types import SimpleNamespace
from unittest.mock import Mock

from domain import ValidationError
from server.routes import GET, POST, api_barcode_lookup, api_release_front_cover


class BarcodeLookupTests(unittest.TestCase):
    def setUp(self):
        self.http = SimpleNamespace(send=Mock())
        self.deezer, self.itunes = Mock(return_value=[]), Mock(return_value=[])
        self.vision = SimpleNamespace(catalog=Mock(return_value=[]),
                                      backups=lambda barcode, catno: [('deezer', self.deezer), ('itunes', self.itunes)])
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
        response = self.http.send.call_args.args[0]
        self.assertEqual(response['barcode'], '4988013047105')
        self.assertEqual(len(response['candidates']), 2)

    def test_no_match_returns_empty_candidates_without_guessing(self):
        api_barcode_lookup(self.http, self.service, {'barcode': '96385074'})
        self.http.send.assert_called_once_with({'barcode': '96385074', 'candidates': [],
            'sources': {'musicbrainz': 'none', 'deezer': 'none', 'itunes': 'none'}})

    def test_musicbrainz_miss_still_returns_backup_candidates(self):
        found = {'id': 'deezer-7714607', 'source': 'deezer', 'identifierMatch': True,
                 'releaseInfo': {'barcode': '4582213912173'}}
        self.deezer.return_value = [found]
        api_barcode_lookup(self.http, self.service, {'barcode': '4582213912173'})
        self.deezer.assert_called_once_with()
        response = self.http.send.call_args.args[0]
        self.assertEqual(response['candidates'], [found])
        self.assertEqual(response['sources'], {'musicbrainz': 'none', 'deezer': 'found', 'itunes': 'none'})

    def test_every_source_is_queried_even_when_musicbrainz_hits(self):
        self.vision.catalog.return_value = [{'id': 'uuid-1', 'identifierMatch': True, 'releaseInfo': {'barcode': '4988064291892'}}]
        self.itunes.return_value = [{'id': 'itunes-1', 'source': 'itunes', 'url': 'u', 'releaseInfo': {'barcode': '4988064291892'}}]
        api_barcode_lookup(self.http, self.service, {'barcode': '4988064291892'})
        self.deezer.assert_called_once_with(); self.itunes.assert_called_once_with()
        [only] = self.http.send.call_args.args[0]['candidates']
        self.assertEqual((only['id'], only['alsoIn'][0]['id']), ('uuid-1', 'itunes-1'))

    def test_one_source_down_still_answers_but_all_down_reports_error(self):
        self.vision.catalog.side_effect = ValidationError('MusicBrainz 暂时不可用')
        api_barcode_lookup(self.http, self.service, {'barcode': '4582213912173'})
        self.assertEqual(self.http.send.call_args.args[0]['sources'],
                         {'musicbrainz': 'MusicBrainz 暂时不可用', 'deezer': 'none', 'itunes': 'none'})
        self.deezer.side_effect = ValidationError('无法连接 Deezer 或请求超时')
        self.itunes.side_effect = ValidationError('无法连接 iTunes 或请求超时')
        with self.assertRaisesRegex(ValidationError, 'MusicBrainz.*Deezer.*iTunes'):
            api_barcode_lookup(self.http, self.service, {'barcode': '4582213912173'})


class ConcurrentLookupTests(unittest.TestCase):
    def test_sources_run_at_the_same_time(self):
        import threading
        from server.routes import lookup_sources
        barrier = threading.Barrier(3, timeout=2)
        def wait(result):
            def run(*args):
                barrier.wait()   # 三个来源都启动了才放行；串行执行会在这里超时
                return result
            return run
        service = SimpleNamespace(releases=SimpleNamespace(catalog=wait([]), backups=lambda barcode, catno: [
            ('deezer', wait([])), ('itunes', wait([{'id': 'itunes-1', 'releaseInfo': {'barcode': barcode}}]))]))
        candidates, sources = lookup_sources(service, '4988064291892', '', lambda found: found)
        self.assertEqual([c['id'] for c in candidates], ['itunes-1'])
        self.assertEqual(sources, {'musicbrainz': 'none', 'deezer': 'none', 'itunes': 'found'})


class ConfirmedReleaseArtTests(unittest.TestCase):
    EDITION = '11111111-1111-4111-8111-111111111111'

    def setUp(self):
        self.http = SimpleNamespace(path='/api/catalog/artwork?id=' + self.EDITION, send=Mock())
        self.art = SimpleNamespace(catalog=Mock(return_value={'images': [
            {'id': 123, 'types': ['Front'], 'thumbnails': {'small': 'https://archive.org/front.jpg'}},
            {'id': 234, 'types': ['Booklet'], 'thumbnails': {'small': 'https://archive.org/inside.jpg'}}
        ]}), image=Mock(return_value=b'\x89PNG\r\n\x1a\nvalid'))
        self.service = SimpleNamespace(twins=SimpleNamespace(art=self.art))

    def test_front_cover_requires_same_release_and_front_image(self):
        self.assertIn('/api/catalog/front-cover', GET)
        self.assertNotIn('/api/catalog/artwork', GET)  # 无调用方，已删除
        self.http.path = '/api/catalog/front-cover?id=' + self.EDITION
        api_release_front_cover(self.http, self.service)
        self.art.image.assert_called_once_with(self.EDITION, '123', preview=True)
        cover = self.http.send.call_args.args[0]['cover']
        self.assertTrue(cover.startswith('data:image/png;base64,'))
        self.art.catalog.return_value = {'images': [{'id': 234, 'types': ['Booklet']}]}
        api_release_front_cover(self.http, self.service)
        self.assertEqual(self.http.send.call_args.args[0]['cover'], '')
        self.art.image.assert_called_once()

    def test_front_cover_stash_returns_short_reference(self):
        import tempfile
        from pathlib import Path
        from server import routes
        routes._FRONT_MEMO.clear()
        store = SimpleNamespace(covers_dir=Path(tempfile.mkdtemp()))
        from storage import Store
        store.stash_cover = lambda r: Store.stash_cover(store, r)
        service = SimpleNamespace(twins=self.service.twins, store=store)
        self.http.path = '/api/catalog/front-cover?stash=1&id=' + self.EDITION
        api_release_front_cover(self.http, service)
        cover = self.http.send.call_args.args[0]['cover']
        self.assertRegex(cover, r'^/api/cover/[0-9a-f]{16}\.png$')
        self.assertTrue((store.covers_dir / cover.rsplit('/', 1)[1]).is_file())

    def test_covers_download_stashes_only_when_asked(self):
        import tempfile
        from pathlib import Path
        from server.routes import api_covers_download
        from storage import Store
        store = SimpleNamespace(covers_dir=Path(tempfile.mkdtemp()))
        store.stash_cover = lambda r: Store.stash_cover(store, r)
        data = {'cover': 'data:image/png;base64,iVBORw0KGgo=', 'coverSource': {'title': 't'}}
        svc = SimpleNamespace(store=store, covers=SimpleNamespace(download=lambda token: dict(data)))
        api_covers_download(self.http, svc, {'token': 'x'})
        self.assertTrue(self.http.send.call_args.args[0]['cover'].startswith('data:image/png'))
        api_covers_download(self.http, svc, {'token': 'x', 'stash': True})
        self.assertRegex(self.http.send.call_args.args[0]['cover'], r'^/api/cover/[0-9a-f]{16}\.png$')

    def test_front_cover_single_request_and_memo(self):
        from server.catalog_art import ArtClient, ArtNotFound
        from server import routes
        routes._FRONT_MEMO.clear()
        art = ArtClient()
        art.read = Mock(return_value=b'\x89PNG\r\n\x1a\nvalid')
        svc = SimpleNamespace(catalog_art=art)
        self.http.path = '/api/catalog/front-cover?id=' + self.EDITION
        api_release_front_cover(self.http, svc)
        api_release_front_cover(self.http, svc)
        art.read.assert_called_once()
        self.assertTrue(self.http.send.call_args.args[0]['cover'].startswith('data:image/png'))
        routes._FRONT_MEMO.clear()
        art.read = Mock(side_effect=ArtNotFound('x'))
        api_release_front_cover(self.http, svc)
        self.assertEqual(self.http.send.call_args.args[0]['cover'], '')


if __name__ == '__main__':
    unittest.main()
