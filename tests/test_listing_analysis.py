"""视觉分析只发送本副本公共身份和照片；失败/歧义不转成已确认事实。"""
import tempfile
import unittest
from domain import ValidationError
from tools.seed_samples import seed_listing_photos, open_store


class ListingAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.ids = seed_listing_photos(self.tmp.name)
        self.store = open_store(self.tmp.name)

    def tearDown(self): self.tmp.cleanup()

    def test_request_omits_private_fields_and_keeps_photo_numbers(self):
        from server.listing_model import image_content
        rid = self.ids['lift-fists']
        with self.store.connect() as db: record = self.store.get(db, 'records', rid)
        content = image_content(record, [(1, '.png', b'image')])
        self.assertEqual(content[0]['text'], '已记录身份（只作核对线索）：Godspeed You! Black Emperor / Lift Your Skinny Fists Like Antennas to Heaven')
        self.assertEqual(content[1]['text'], '照片编号 1（从 0 开始）')
        self.assertEqual(content[2]['image_url']['url'], 'data:image/png;base64,aW1hZ2U=')
        self.assertNotIn(record['location'], str(content))

    def test_validation_rejects_invented_photo_evidence_and_non_json(self):
        from server.listing_model import parse_analysis
        with self.assertRaises(ValidationError): parse_analysis('not json', [0])
        with self.assertRaises(ValidationError): parse_analysis('{}', [0])
        with self.assertRaises(ValidationError):
            parse_analysis('{"observations":[{"text":"擦痕","photos":[2]}]}', [0])
        result = parse_analysis('{"observations":[{"text":"擦痕","photos":[0]}],"pending":["需试听"]}', [0])
        self.assertEqual(result['pending'], ['需试听'])
        self.assertEqual(result['observations'][0]['photos'], [0])

    def test_candidates_require_identifiers_and_stay_unconfirmed(self):
        from server.listing_analysis import catalogue_candidates
        class Catalog:
            def catalog(self, fields):
                self.fields = fields
                return [{'id': 'release-1', 'title': '候选', 'artist': '艺人', 'identifierMatch': True,
                         'releaseInfo': {'country': 'JP', 'barcode': '12345678', 'releaseDate': '2001'}}]
        catalog = Catalog()
        self.assertEqual(catalogue_candidates(catalog, {'identifiers': []}), ([], ''))
        candidates, error = catalogue_candidates(catalog, {'identifiers': [
            {'kind': 'barcode', 'text': '12345678', 'photos': [0]}]})
        self.assertEqual(candidates[0]['country'], 'JP')
        self.assertNotIn('confirmed', candidates[0])
        self.assertEqual(error, '')

    def test_model_failure_is_retryable_and_does_not_write_ledger(self):
        from server.listing_analysis import ListingAnalysis
        class Model:
            def analyze(self, record, images): raise ValidationError('模型不可用')
        service = ListingAnalysis(self.store, None, Model())
        rid = self.ids['lift-fists']
        with self.store.connect() as db: r = self.store.get(db, 'records', rid)
        before = self.store.backup()
        job = service.start({'id': rid, 'revision': r['revision'], 'photoRevision': r['photoRevision']})
        service.executor.shutdown(wait=True)
        status = service.status(job['id'])
        self.assertEqual(status['status'], 'failed')
        self.assertEqual(status['error'], '模型不可用')
        self.assertEqual(self.store.backup()['records'], before['records'])
