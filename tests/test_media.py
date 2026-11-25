"""介质（D-053）：CD / 黑胶 / 其他的识别，发行版检索与备用来源按所选介质过滤，黑胶曲目的面编号。"""
import unittest
from unittest.mock import patch

from domain import ValidationError, clean_medium, clean_release_info, medium_accepts, medium_of
from server.release_catalog import ReleaseCatalog

CD = {'id': '11111111-1111-1111-1111-111111111111', 'title': 'Album', 'media': [{'format': 'CD'}],
      'label-info': [{'catalog-number': 'TEST-1'}]}
LP = {'id': '22222222-2222-2222-2222-222222222222', 'title': 'Album', 'media': [{'format': '12" Vinyl'}, {'format': '12" Vinyl'}],
      'label-info': [{'catalog-number': 'TEST-1'}]}
FIELDS = {'title': '', 'artist': '', 'releaseInfo': {'barcode': '', 'catalogNumber': 'TEST-1'}}


class Source:
    def search(self, barcode='', catno='', medium='cd'): return []


class MediumTests(unittest.TestCase):
    def test_medium_of_format_text(self):
        cases = {'CD': 'cd', 'Hybrid SACD': 'cd', 'Blu-spec CD2': 'cd', '12" Vinyl': 'vinyl', 'Vinyl': 'vinyl', '7"': 'vinyl',
                 'LP': 'vinyl', 'Cassette': 'other', 'DVD-Video': 'other', '': ''}
        self.assertEqual({k: medium_of(k) for k in cases}, cases)
        self.assertTrue(medium_accepts('other', []))
        self.assertFalse(medium_accepts('vinyl', ['CD']))
        self.assertEqual([clean_medium(x) for x in ('vinyl', 'other', None, 'tape')], ['vinyl', 'other', 'cd', 'cd'])
        # 取发行版详情时没带介质：不核对（保存时核对、查询页展开候选都走这条）
        self.assertIsNone(clean_medium(None, None))

    def test_catalog_filters_by_chosen_medium_and_caches_each_separately(self):
        service = ReleaseCatalog()
        with patch('server.release_catalog.read_json', return_value={'releases': [CD, LP]}) as request:
            cd = service.catalog(FIELDS)
            vinyl = service.catalog(FIELDS, 'vinyl')
            other = service.catalog(FIELDS, 'other')
            service.catalog(FIELDS, 'vinyl')
        self.assertEqual([c['id'] for c in cd], [CD['id']])
        self.assertEqual([c['id'] for c in vinyl], [LP['id']])
        self.assertEqual(vinyl[0]['releaseInfo']['format'], '12" Vinyl + 12" Vinyl')
        self.assertEqual(len(other), 2)
        self.assertEqual(request.call_count, 3)   # 同一查询按介质各缓存一份

    def test_digital_and_ndl_sources_only_join_cd_lookups(self):
        service = ReleaseCatalog(discogs=Source(), deezer=Source(), itunes=Source(), ndl=Source())
        self.assertEqual([n for n, _ in service.backups('4988013047105')], ['discogs', 'deezer', 'itunes'])
        self.assertEqual([n for n, _ in service.backups('4988013047105', medium='vinyl')], ['discogs'])
        self.assertEqual([n for n, _ in service.backups('', 'TEST-1')], ['discogs', 'ndl'])
        self.assertEqual([n for n, _ in service.backups('', 'TEST-1', 'vinyl')], ['discogs'])

    def test_musicbrainz_vinyl_tracks_keep_side_numbers(self):
        release = dict(LP, media=[{'format': '12" Vinyl', 'position': 1, 'tracks': [
            {'position': 1, 'number': 'A1', 'title': 'One'}, {'position': 2, 'number': 'B1', 'title': 'Two'}]}])
        with patch('server.release_catalog.read_json', return_value=release):
            info = ReleaseCatalog().release_details(LP['id'], 'vinyl')
        self.assertEqual([(t['position'], t['number']) for t in info['media'][0]['tracks']], [(1, 'A1'), (2, 'B1')])
        with patch('server.release_catalog.read_json', return_value=dict(CD, media=[{'format': 'CD', 'tracks': [
                {'position': 1, 'number': '1', 'title': 'One'}]}])):
            self.assertNotIn('number', ReleaseCatalog().release_details(CD['id'])['media'][0]['tracks'][0])
        with self.assertRaisesRegex(ValidationError, '黑胶'), \
                patch('server.release_catalog.read_json', return_value=dict(CD, media=[{'format': 'CD', 'tracks': []}])):
            ReleaseCatalog().release_details(CD['id'], 'vinyl')

    def test_saved_track_side_label_is_validated(self):
        info = clean_release_info({'media': [{'position': 1, 'format': 'Vinyl', 'tracks': [{'position': 1, 'number': 'A1', 'title': 'x'}]}]})
        self.assertEqual(info['media'][0]['tracks'][0]['number'], 'A1')
        with self.assertRaises(ValidationError):
            clean_release_info({'media': [{'position': 1, 'tracks': [{'position': 1, 'number': 'A' * 9, 'title': 'x'}]}]})


if __name__ == '__main__':
    unittest.main()
