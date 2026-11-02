"""并发检索的合并规则：只按条码 / 编号精确去重，日本 JAN 只影响顺序，不改传入候选。"""
import unittest

from server.release_merge import japanese, merge

JAN = '4988064291892'


def cand(ident, source, barcode='', catno='', country='', cover='', label='', date=''):
    return {'id': ident, 'source': source, 'url': f'https://{source}.test/{ident}', 'title': 't', 'artist': 'a',
            'cover': cover, 'releaseInfo': {'barcode': barcode, 'catalogNumber': catno, 'country': country,
                                            'label': label, 'releaseDate': date}}


class MergeTests(unittest.TestCase):
    def test_digital_with_same_barcode_folds_into_physical_and_lends_cover(self):
        mb = cand('uuid-1', 'musicbrainz', JAN, 'AVCA-29189', 'JP')
        deezer = cand('deezer-1', 'deezer', '0' + JAN, cover='https://dz/1.jpg')
        itunes = cand('itunes-1', 'itunes', JAN, cover='https://mz/1.jpg')
        [only] = merge({'musicbrainz': [mb], 'deezer': [deezer], 'itunes': [itunes]}, JAN)
        self.assertEqual(only['id'], 'uuid-1')
        # 日本 JAN：iTunes 先于 Deezer，封面借 iTunes 的
        self.assertEqual([r['source'] for r in only['alsoIn']], ['itunes', 'deezer'])
        self.assertEqual(only['cover'], 'https://mz/1.jpg')
        self.assertNotIn('alsoIn', mb)   # 不改传入候选
        self.assertEqual(mb['cover'], '')

    def test_physical_own_cover_is_kept(self):
        mb = cand('uuid-1', 'musicbrainz', JAN, cover='https://caa/x.jpg')
        [only] = merge({'musicbrainz': [mb], 'itunes': [cand('itunes-1', 'itunes', JAN, cover='https://mz/1.jpg')]}, JAN)
        self.assertEqual(only['cover'], 'https://caa/x.jpg')

    def test_two_digital_releases_keep_the_richer_one(self):
        deezer = cand('deezer-1', 'deezer', JAN)
        itunes = cand('itunes-1', 'itunes', JAN, cover='https://mz/1.jpg', label='AVEX', date='2009-04-22')
        [only] = merge({'deezer': [deezer], 'itunes': [itunes]}, '4006381333931')   # 非日本：Deezer 先排
        self.assertEqual(only['id'], 'itunes-1')
        self.assertEqual([r['id'] for r in only['alsoIn']], ['deezer-1'])

    def test_multiple_musicbrainz_editions_with_same_barcode_all_stay_and_borrow_no_cover(self):
        # 同码同编号的 MusicBrainz 版次（如私录借用条码）也不互相合并；数字封面无法确定属于哪一版，不借
        editions = [cand('uuid-1', 'musicbrainz', JAN, 'DGCD-24425'), cand('uuid-2', 'musicbrainz', JAN, 'DGCD-24425')]
        found = merge({'musicbrainz': editions, 'itunes': [cand('itunes-1', 'itunes', JAN, cover='https://mz/1.jpg')]}, JAN)
        self.assertEqual([c['id'] for c in found], ['uuid-1', 'uuid-2'])
        self.assertEqual([[r['id'] for r in c['alsoIn']] for c in found], [['itunes-1'], ['itunes-1']])
        self.assertEqual([c['cover'] for c in found], ['', ''])

    def test_also_in_lists_each_source_once(self):
        storefronts = [cand(f'itunes-{n}', 'itunes', JAN) for n in range(5)]
        [only] = merge({'musicbrainz': [cand('uuid-1', 'musicbrainz', JAN)], 'itunes': storefronts}, JAN)
        self.assertEqual([r['id'] for r in only['alsoIn']], ['itunes-0'])

    def test_discogs_folds_only_when_catalog_number_and_barcode_both_match(self):
        mb = cand('uuid-1', 'musicbrainz', JAN, 'AVCA-29189 / AVCA29189')
        same = cand('discogs-1', 'discogs', JAN, 'avca 29189')
        other_press = cand('discogs-2', 'discogs', '', 'AVCA-29189')
        found = merge({'musicbrainz': [mb], 'discogs': [same, other_press]})
        self.assertEqual([c['id'] for c in found], ['uuid-1', 'discogs-2'])
        self.assertEqual(found[0]['alsoIn'][0]['id'], 'discogs-1')

    def test_japanese_barcode_puts_japan_editions_first_without_dropping_others(self):
        us, jp = cand('uuid-us', 'musicbrainz', JAN, country='US'), cand('uuid-jp', 'musicbrainz', JAN, country='JP')
        self.assertEqual([c['id'] for c in merge({'musicbrainz': [us, jp]}, JAN)], ['uuid-jp', 'uuid-us'])
        self.assertEqual([c['id'] for c in merge({'musicbrainz': [us, jp]}, '0602537000000')], ['uuid-us', 'uuid-jp'])

    def test_physical_before_digital_and_unrelated_digital_listed(self):
        found = merge({'itunes': [cand('itunes-9', 'itunes', '4988064000001')],
                       'musicbrainz': [cand('uuid-1', 'musicbrainz', JAN)]}, JAN)
        self.assertEqual([c['id'] for c in found], ['uuid-1', 'itunes-9'])

    def test_ndl_folds_into_same_catalog_number_or_is_listed_after_physical(self):
        mb = [cand('uuid-1', 'musicbrainz', JAN, 'AVCA-29189'), cand('uuid-2', 'musicbrainz', JAN, 'AVCA-29189')]
        same = cand('ndl-000010099246', 'ndl', '', 'avca29189')
        other = cand('ndl-000000000001', 'ndl', '', 'AVCA-30000')
        found = merge({'musicbrainz': mb, 'discogs': [cand('discogs-1', 'discogs', '', 'AVCA-30001')], 'ndl': [same, other]})
        self.assertEqual([c['id'] for c in found], ['uuid-1', 'uuid-2', 'discogs-1', 'ndl-000000000001'])
        self.assertEqual([[r['source'] for r in c.get('alsoIn', [])] for c in found[:2]], [['ndl'], ['ndl']])

    def test_japanese_prefix(self):
        self.assertTrue(japanese(JAN)); self.assertTrue(japanese('4534530000000'))
        self.assertFalse(japanese('0602537000000')); self.assertFalse(japanese('49880642'))


if __name__ == '__main__':
    unittest.main()
