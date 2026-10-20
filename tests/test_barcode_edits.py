"""Editable barcodes require MusicBrainz identity verification before a ledger write."""
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from domain import ValidationError
from server.routes import api_records, api_verify_barcode, verify_barcode_release
from storage import Store

EDITION = '11111111-1111-4111-8111-111111111111'
BARCODE = '4988013047105'
OTHER = '4006381333931'


class VerificationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / 'albums.sqlite3')
        self.ident = self.store.save({'title':'Test Album', 'artist':'Fixture',
            'releaseInfo':{'barcode':BARCODE,'musicBrainzReleaseId':EDITION}})['ids'][0]
        self.source = SimpleNamespace(release_details=Mock(return_value={'barcode':BARCODE}))
        self.svc = SimpleNamespace(store=self.store, releases=self.source, shops=None)
        self.h = SimpleNamespace(send=Mock())

    def tearDown(self):
        self.tmp.cleanup()

    def edited(self, barcode, edition=EDITION):
        record = next(r for r in self.store.state()['records'] if r['id']==self.ident)
        return {'id':self.ident,'revision':record['revision'],
            'releaseInfo':{**record['releaseInfo'], 'barcode':barcode,
                           'musicBrainzReleaseId':edition}}

    def save(self, body):
        with patch('server.routes.prewarm'):
            api_records(self.h, self.svc, body)

    def test_exact_matching_barcode_can_be_saved(self):
        self.save(self.edited(BARCODE))
        self.assertFalse(self.source.release_details.called)  # unchanged
        api_verify_barcode(self.h, self.svc,
            {'barcode':BARCODE,'releaseId':EDITION})
        self.assertEqual(self.h.send.call_args.args[0]['valid'],True)
        self.source.release_details.assert_called_once_with(EDITION)

    def test_changed_barcode_fails_if_musicbrainz_release_does_not_match(self):
        original=self.edited(BARCODE)
        with self.assertRaisesRegex(ValidationError, '不属于当前发行版本'):
            self.save(self.edited(OTHER))
        self.assertEqual(self.edited(BARCODE),original)

    def test_changed_barcode_without_confirmed_release_rejected(self):
        with self.assertRaisesRegex(ValidationError,'查询并选择'):
            self.save(self.edited(OTHER, ''))

    def new_record(self, **info):
        return {'title':'Red', 'artist':'King Crimson', 'releaseInfo':{'catalogNumber':'IECP-50008', **info}}

    def test_new_discogs_release_is_verified_against_discogs_barcode(self):
        self.source.release_details.return_value = {'barcode':'4582213912173'}
        self.save(self.new_record(barcode='4582213912173', discogsReleaseId='7714607'))
        self.source.release_details.assert_called_once_with('discogs-7714607')
        with self.assertRaisesRegex(ValidationError, 'Discogs 中该条码'):
            self.save(self.new_record(barcode=BARCODE, discogsReleaseId='7714607'))

    def test_manual_release_saves_without_catalog_verification(self):
        self.save(self.new_record(manualRelease='1'))
        self.save(self.new_record(barcode='4582213912173', manualRelease='1'))
        self.assertFalse(self.source.release_details.called)
        saved = [r for r in self.store.state()['records'] if r['title']=='Red']
        self.assertEqual(len(saved), 2)
        self.assertEqual(saved[0]['releaseInfo']['manualRelease'], '1')
        self.assertEqual(saved[0]['releaseInfo']['musicBrainzReleaseId'], '')

    def test_checksum_invalid_rejected_before_database_query(self):
        with self.assertRaisesRegex(ValidationError,'校验位'):
            self.save(self.edited(BARCODE[:-1]+'4'))
        self.source.release_details.assert_not_called()

    def test_network_validation_error_must_not_save(self):
        self.source.release_details.side_effect=ValidationError('MusicBrainz 暂不可用')
        with self.assertRaisesRegex(ValidationError,'暂不可用'):
            self.save(self.edited(OTHER))
        self.assertEqual(self.edited(BARCODE)['releaseInfo']['barcode'],BARCODE)

    def test_barcode_cannot_be_removed_for_a_release_with_barcode(self):
        with self.assertRaisesRegex(ValidationError,'不能直接清除'):
            self.save(self.edited(''))

    def test_barcode_can_change_when_exact_release_data_confirms(self):
        self.source.release_details.return_value={'barcode':OTHER}
        self.save(self.edited(OTHER))
        self.assertEqual(self.edited(OTHER)['releaseInfo']['barcode'],OTHER)

    def test_legacy_unchanged_record_does_not_require_network(self):
        self.save(self.edited(BARCODE))
        self.source.release_details.assert_not_called()


if __name__ == '__main__':
    unittest.main()
