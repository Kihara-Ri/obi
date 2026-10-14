import unittest
from domain import ValidationError, clean_release_info


class ReleaseMediaTests(unittest.TestCase):
    def test_preserves_cd_hierarchy_and_durations(self):
        info = clean_release_info({'tracklist': ['1-1 Shine','2-1 Time'], 'media': [
            {'position': 1, 'format': 'CD', 'title': 'Studio', 'tracks': [
                {'position': 1, 'title': 'Shine', 'lengthMs': 123000},
                {'position': 2, 'title': 'No duration'}]},
            {'position': 2, 'format': 'CD', 'title': '', 'tracks': [
                {'position': 1, 'title': 'Time', 'lengthMs': 450000}]}]})
        self.assertEqual(len(info['media']), 2)
        self.assertEqual(info['media'][0]['tracks'][0]['lengthMs'], 123000)
        self.assertNotIn('lengthMs', info['media'][0]['tracks'][1])
        self.assertEqual(info['tracklist'], ['1-1 Shine', '2-1 Time'])
        self.assertEqual(clean_release_info(info)['media'], info['media'])

    def test_old_records_remain_valid(self):
        old = clean_release_info({'tracklist': ['1-1 A', '2-1 B']})
        self.assertNotIn('media', old)
        self.assertEqual(old['tracklist'], ['1-1 A', '2-1 B'])

    def test_rejects_malformed_or_oversized_media(self):
        samples = [
            {'media': [1]},
            {'media': [{'position': '1', 'tracks': []}]},
            {'media': [{'position': 1, 'format': 'CD', 'tracks': 'bad'}]},
            {'media': [{'position': 1, 'tracks': [{'position': 1, 'title': 'A', 'lengthMs': -5}]}]},
            {'media': [{'position': 1, 'tracks': [{'position': 1, 'title': 'A', 'lengthMs': 1.5}]}]},
            {'media': [{'position': 1, 'tracks': [{'position': 1, 'title': 'A'}] * 501}]},
        ]
        for value in samples:
            with self.subTest(value=str(value)[:100]):
                with self.assertRaises(ValidationError): clean_release_info(value)


if __name__ == '__main__': unittest.main()
