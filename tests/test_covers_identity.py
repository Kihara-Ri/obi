import unittest
from covers import CoverService
from kana import romaji


class KanaAndIdentity(unittest.TestCase):
    def test_romaji(self):
        self.assertEqual(romaji('キセキ'), 'kiseki')
        self.assertEqual(romaji('ジャズ'), 'jazu')
        self.assertEqual(romaji('Hello'), 'Hello')

    def test_romanized_itunes_title_is_exact_for_same_artist_only(self):
        c = CoverService()
        url = 'https://is1-ssl.mzstatic.com/a/100x100bb.jpg'
        self.assertTrue(c.candidate('キセキ', 'GReeeeN', 'Kiseki - Single', 'GReeeeN', 't1', url)['exact'])
        self.assertFalse(c.candidate('キセキ', 'GReeeeN', 'Kiseki - Single', '高橋優', 't2', url)['exact'])

    def test_release_identity_uses_canonical_names(self):
        c = CoverService()
        c.metadata = lambda url: {'title': '狂気', 'release-group': {'id': 'f5093c06-23e3-404f-aeaa-40f72885ee3a',
            'title': 'The Dark Side of the Moon'}, 'artist-credit': [{'name': 'ピンク・フロイド', 'artist': {'name': 'Pink Floyd'}}]}
        ident = c.release_identity('35bd2c37-d3d2-34b8-bdf5-5afa0693e4b9')
        self.assertEqual((ident['title'], ident['artist']), ('The Dark Side of the Moon', 'Pink Floyd'))
        self.assertIsNone(c.release_identity('nope'))


class ReleaseCredit(unittest.TestCase):
    def test_credit_name_resolves_canonical_artist(self):
        import threading
        from server.artists import ArtistService
        svc = object.__new__(ArtistService)
        svc._inflight, svc._inflight_lock = {}, threading.Lock()
        rid, aid = '35bd2c37-d3d2-34b8-bdf5-5afa0693e4b9', '83d91898-7763-47d7-b03b-b92132375c47'
        svc._records_of = lambda name: [{'releaseInfo': {'musicBrainzReleaseId': rid}}]
        svc.mb = type('M', (), {'get': lambda self, path, params=None: {'artist-credit': [
            {'name': 'ピンク・フロイド', 'artist': {'id': aid, 'name': 'Pink Floyd'}}]}})()
        self.assertEqual(svc._release_credit('ピンク・フロイド'), {'mbid': aid, 'name': 'Pink Floyd'})
        self.assertIsNone(svc._release_credit('Someone Else'))
