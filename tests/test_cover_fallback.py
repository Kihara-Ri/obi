"""版本自己没有封面时的退路（CoverService.fallback）：同一张专辑的封面 → 同名 iTunes 数字封面 → 没有。"""
import unittest
from unittest.mock import patch

from covers import CoverService
from domain import ValidationError

RID = '11111111-2222-3333-4444-555555555555'
GID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
IDENT = {'title': 'Memories...Do Not Open', 'artist': 'The Chainsmokers', 'group': GID, 'groupTitle': 'Memories...Do Not Open'}


def hit(provider, token, exact=True):
    return {'token': token, 'title': 'Memories...Do Not Open', 'artist': 'The Chainsmokers', 'thumbnail': 'https://is1-ssl.mzstatic.com/x/100x100bb.jpg',
            'year': '2017', 'provider': provider, 'score': 1.0, 'exact': exact}


class FallbackTests(unittest.TestCase):
    def test_same_album_cover_comes_first(self):
        s = CoverService()
        with patch.object(s, 'release_identity', return_value=IDENT), \
             patch.object(s, 'group_front', return_value='https://coverartarchive.org/release/x/1-500.jpg'), \
             patch.object(s, 'search') as search:
            found = s.fallback('Memories...Do Not Open', 'The Chainsmokers', RID)
        self.assertEqual((found['kind'], found['token']), ('album', 'CAA-' + GID))
        search.assert_not_called()
        self.assertIn('CAA-' + GID, s.choices)   # 可直接 covers/download

    def test_exact_itunes_when_album_has_no_cover(self):
        s = CoverService()
        choices = [hit('iTunes', 'JP-1', exact=False), hit('iTunes', 'JP-2')]
        with patch.object(s, 'release_identity', return_value=IDENT), \
             patch.object(s, 'group_front', side_effect=ValidationError('404')), \
             patch.object(s, 'search', return_value={'candidates': choices}):
            found = s.fallback('Memories...Do Not Open', 'The Chainsmokers', RID)
        self.assertEqual((found['kind'], found['token']), ('digital', 'JP-2'))

    def test_discogs_version_uses_same_named_album_then_nothing_loose(self):
        s = CoverService()
        with patch.object(s, 'search', return_value={'candidates': [hit('MusicBrainz / Cover Art Archive', 'CAA-g'), hit('iTunes', 'JP-2')]}):
            self.assertEqual(s.fallback('Memories...Do Not Open', 'The Chainsmokers')['kind'], 'album')
        s = CoverService()
        with patch.object(s, 'search', return_value={'candidates': [hit('iTunes', 'JP-1', exact=False)]}):
            self.assertIsNone(s.fallback('Memories...Do Not Open', 'The Chainsmokers'))   # 名字没对上的不拿

    def test_answer_is_remembered(self):
        s = CoverService()
        with patch.object(s, 'search', return_value={'candidates': []}) as search:
            s.fallback('A', 'B'); s.fallback('A', 'B')
        self.assertEqual(search.call_count, 1)


if __name__ == '__main__':
    unittest.main()
