"""查询页文字搜索：专辑去重列表、版本展开与排序、Discogs 兜底（固定夹具，不联网）。"""
import unittest
from unittest.mock import patch

from domain import ValidationError
from server.release_catalog import ReleaseCatalog
from server.text_search import group_versions, search_albums

GID = '11111111-1111-1111-1111-111111111111'


def release(rid, country, barcode, date):
    return {'id': rid, 'title': 'Illinois', 'barcode': barcode, 'country': country, 'date': date,
            'artist-credit': [{'name': 'Sufjan Stevens'}], 'media': [{'format': 'CD'}],
            'label-info': [{'catalog-number': 'X-1', 'label': {'name': 'L'}}]}


class TextSearchTests(unittest.TestCase):
    def test_groups_listed_with_cover_and_kind(self):
        data = {'release-groups': [{'id': GID, 'title': 'Illinois', 'primary-type': 'Album', 'first-release-date': '2005-07-05',
                                    'artist-credit': [{'name': 'Sufjan Stevens'}]}, {'id': 'bad'}]}
        cat = ReleaseCatalog()
        with patch('server.release_catalog.read_json', return_value=data) as req:
            groups, sources = search_albums(cat, 'illinois sufjan stevens')
        self.assertEqual([(g['title'], g['year'], g['kind']) for g in groups], [('Illinois', '2005', 'album')])
        self.assertIn(GID, groups[0]['cover'])
        self.assertEqual(sources['musicbrainz'], 'found')
        self.assertIn('releasegroup', req.call_args.args[0])

    def test_versions_prefer_japan_and_barcode(self):
        data = {'releases': [release('22222222-2222-2222-2222-222222222222', 'US', '', '2005'),
                             release('33333333-3333-3333-3333-333333333333', 'JP', '4988000000000', '2006'),
                             {'id': '44444444-4444-4444-4444-444444444444', 'media': [{'format': 'Vinyl'}]}]}
        with patch('server.release_catalog.read_json', return_value=data):
            found = group_versions(ReleaseCatalog(), GID)
        self.assertEqual([c['releaseInfo']['country'] for c in found], ['JP', 'US'])

    def test_identical_versions_collapse_and_zero_date_hidden(self):
        data = {'releases': [release('22222222-2222-2222-2222-22222222222%d' % n, 'US', '', '0') for n in range(4)]}
        with patch('server.release_catalog.read_json', return_value=data):
            found = group_versions(ReleaseCatalog(), GID)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]['releaseInfo']['releaseDate'], '')

    def test_rejects_short_text_and_bad_ids(self):
        with self.assertRaises(ValidationError): search_albums(ReleaseCatalog(), ' a ')
        with self.assertRaises(ValidationError): group_versions(ReleaseCatalog(), '../x')

    def test_discogs_fallback_when_musicbrainz_empty(self):
        class Discogs:
            def _get(self, path, params=None):
                return {'results': [{'id': 7, 'title': 'Sufjan Stevens (2) - Illinois', 'year': '2005'}]}
        cat = ReleaseCatalog(discogs=Discogs())
        with patch('server.release_catalog.read_json', return_value={'release-groups': []}):
            groups, sources = search_albums(cat, 'illinois sufjan')
        self.assertEqual(groups[0]['id'], 'discogs-m7')
        self.assertEqual(groups[0]['artist'], 'Sufjan Stevens')
        self.assertEqual(sources, {'musicbrainz': 'none', 'discogs': 'found'})


if __name__ == '__main__':
    unittest.main()


class GroupCoverTests(unittest.TestCase):
    def setUp(self):
        from server import group_covers
        self.gc = group_covers
        group_covers._cache.clear()

    def groups(self):
        return [{'id': GID, 'title': 'Illinois', 'artist': 'Sufjan Stevens', 'source': 'musicbrainz',
                 'cover': f'https://coverartarchive.org/release-group/{GID}/front-250'}]

    def fake(self, results):
        import json

        class Covers:
            def read(self, url, limit): return json.dumps({'results': results}).encode()
        return Covers()

    def test_itunes_preferred_when_title_and_artist_match(self):
        item = {'collectionName': 'Illinois', 'artistName': 'Sufjan Stevens',
                'artworkUrl100': 'https://is1-ssl.mzstatic.com/image/x/100x100bb.jpg'}
        g = self.gc.attach_covers(self.fake([item]), self.groups())[0]
        self.assertEqual(g['coverSource'], 'itunes')
        self.assertIn('300x300bb', g['cover'])

    def test_falls_back_to_caa_when_no_strict_match(self):
        item = {'collectionName': 'Other', 'artistName': 'Sufjan Stevens',
                'artworkUrl100': 'https://is1-ssl.mzstatic.com/image/x/100x100bb.jpg'}
        g = self.gc.attach_covers(self.fake([item]), self.groups())[0]
        self.assertEqual(g['coverSource'], 'caa')
        self.assertIn('coverartarchive', g['cover'])

    def test_discogs_group_without_cover_has_empty_source(self):
        g = self.gc.attach_covers(self.fake([]), [{'id': 'discogs-m7', 'source': 'discogs', 'cover': ''}])[0]
        self.assertEqual(g['coverSource'], '')
