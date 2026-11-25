"""黑胶副本的规格与品相（D-055）：校验、编辑回显、上架资料包与采购评估口径；复用固定样本库。"""
from contextlib import closing
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import tempfile
import unittest

from domain import ValidationError, clean_record, clean_vinyl
from server import routes
from server.insight_stats import record_format
from server.listing_context import public_context
from tools.seed_samples import VINYL_COPY, open_store, seed_vinyl_review


class VinylSpecTests(unittest.TestCase):
    def test_clean_vinyl_keeps_known_values_and_drops_empty(self):
        self.assertEqual(clean_vinyl({'size': '12', 'speed': '', 'color': ' 红 ', 'mediaGrade': 'VG+'}),
                         {'size': '12', 'color': '红', 'mediaGrade': 'VG+'})
        self.assertIsNone(clean_vinyl({'size': '', 'color': '  '}))
        self.assertIsNone(clean_vinyl(None))
        for bad in ({'size': '9'}, {'speed': 33}, {'mediaGrade': 'EX'}, {'weight': '180g'}, {'color': 'x' * 41}, '12'):
            with self.assertRaises(ValidationError, msg=bad):
                clean_vinyl(bad)

    def test_record_without_specs_does_not_store_the_field(self):
        record = clean_record({'title': 'A', 'artist': 'B', 'vinyl': {'size': ''}})
        self.assertNotIn('vinyl', record)
        self.assertEqual(clean_record({'title': 'A', 'artist': 'B', 'vinyl': {'speed': '45'}})['vinyl'], {'speed': '45'})

    def test_vinyl_specs_make_the_copy_lp_even_without_format(self):
        self.assertEqual(record_format({'releaseInfo': {}}), 'CD')
        self.assertEqual(record_format({'releaseInfo': {}, 'vinyl': {'speed': '33'}}), 'LP')


class VinylCopyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name)
        self.ids = seed_vinyl_review(self.folder)
        self.store = open_store(self.folder)

    def row(self, key):
        with closing(self.store.connect()) as db:
            return self.store.get(db, 'records', self.ids[key])

    def test_metadata_edit_round_trips_and_clears_specs(self):
        h, svc = SimpleNamespace(send=Mock()), SimpleNamespace(store=self.store, shops=None, artists=None, releases=None)
        row = self.row('remain')
        spec = {'size': '12', 'speed': '45', 'sleeveGrade': 'G'}
        routes.api_record_metadata(h, svc, {'id': row['id'], 'revision': row['revision'], 'vinyl': spec})
        echoed, = h.send.call_args.args[0]['records']
        self.assertEqual((echoed['vinyl'], self.row('remain')['vinyl']), (spec, spec))
        row = self.row('remain')
        routes.api_record_metadata(h, svc, {'id': row['id'], 'revision': row['revision'], 'vinyl': None})
        self.assertNotIn('vinyl', self.row('remain'))

    def test_listing_package_carries_medium_and_vinyl_facts(self):
        double = public_context(self.row('mbdtf'))['copy']
        self.assertEqual((double['medium'], double['vinyl'], double['version']),
                         ('vinyl', VINYL_COPY['mbdtf'][1], 'Gatefold Jacket'))
        cd = public_context(self.row('dsotm-jp'))['copy']
        self.assertEqual(cd['medium'], 'cd')
        self.assertNotIn('vinyl', cd)


if __name__ == '__main__':
    unittest.main()
