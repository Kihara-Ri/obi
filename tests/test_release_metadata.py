import unittest
from types import SimpleNamespace
from unittest.mock import Mock

from domain import clean_release_info, ValidationError
from twins import appearance, same_appearance
from server.recognition import display_release_title
from server.routes import api_catalog_number_lookup


class ReleaseMetadataTests(unittest.TestCase):
    def test_non_barcode_release_can_be_confirmed_and_keep_packaging(self):
        data = clean_release_info({
            'barcode': '', 'musicBrainzReleaseId': '11111111-1111-4111-8111-111111111111',
            'catalogNumber': 'AMCY-2434', 'packaging': 'Cardboard/Paper Sleeve',
            'edition': 'vinyl replica paper sleeve edition', 'country': 'JP'})
        self.assertEqual(data['barcode'], '')
        self.assertEqual(data['packaging'], 'Cardboard/Paper Sleeve')
        self.assertEqual(data['country'], 'JP')

    def test_old_twin_snapshot_without_package_metadata_remains_current(self):
        record = {'title': 'A', 'artist': 'B', 'releaseInfo': {'barcode': '4988013047105',
                  'packaging': '', 'musicBrainzReleaseId': ''}}
        old = appearance(record)
        old['releaseInfo'].pop('packaging')
        self.assertTrue(same_appearance(record, old))
        record['releaseInfo']['packaging'] = 'Jewel Case'
        self.assertFalse(same_appearance(record, old))

    def test_editorial_brackets_only_at_title_boundary(self):
        self.assertEqual(display_release_title('[Led Zeppelin IV]'), 'Led Zeppelin IV')
        self.assertEqual(display_release_title('Foo [Live]'), 'Foo [Live]')

    def test_catalog_lookup_filters_partial_and_guesses(self):
        http = SimpleNamespace(send=Mock())
        candidate = lambda name: {'id': name, 'identifierMatch': True,
                                  'releaseInfo': {'catalogNumber': name}}
        svc = SimpleNamespace(vision=SimpleNamespace(catalog=Mock(return_value=[
            candidate('AMCY-2434'), candidate('AMCY-243'), candidate('OTHER-13')])) )
        api_catalog_number_lookup(http, svc, {'catalogNumber':'AMCY-2434'})
        result = http.send.call_args.args[0]
        self.assertEqual([c['id'] for c in result['candidates']], ['AMCY-2434'])
        svc.vision.catalog.assert_called_once_with({
            'title':'', 'artist':'', 'releaseInfo':{'barcode':'','catalogNumber':'AMCY-2434'}})
        with self.assertRaises(ValidationError):
            api_catalog_number_lookup(http, svc, {'catalogNumber':'*'})
