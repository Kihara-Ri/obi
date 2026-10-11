"""固定测试样本库守护测试：样本清单的不变量（状态数、成本缺失、利润口径、分摊总额、幂等与护栏）。

样本定义在 tools/seed_samples.py；改动样本金额/汇率/清单时这里的精确断言会拦住，
防止之后所有浏览器验收建立在悄悄漂移的样本上。
"""
import importlib.util
import sqlite3
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

EXPECTED_STATUS = {'domestic': 8, 'overseas': 5, 'transit': 3, 'shipping': 1,
                   'sold': 3, 'trash': 1}


def load_seed_module():
    spec = importlib.util.spec_from_file_location('seed_samples', ROOT / 'tools' / 'seed_samples.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class SampleLibraryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.seed = load_seed_module()
        cls.tmp = tempfile.TemporaryDirectory()
        cls.dir = Path(cls.tmp.name) / 'samples'
        cls.ids = cls.seed.seed(cls.dir)
        cls.store = cls.seed.open_store(cls.dir)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def state(self):
        return self.store.state()

    def record(self, key):
        return next(r for r in self.state()['records'] if r['id'] == self.ids[key])

    def sale(self, order_id):
        return next(s for s in self.state()['sales'] if s['orderId'] == order_id)

    def shipment(self):
        return self.state()['shipments'][0]

    def test_roster_statuses_and_modules(self):
        st = self.state()
        counts = {}
        for r in st['records']:
            counts[r['status']] = counts.get(r['status'], 0) + 1
        self.assertEqual(counts, EXPECTED_STATUS)
        self.assertEqual(len({(r['title'], r['artist']) for r in st['records']}), 19)
        self.assertEqual(st['modules']['configured'], True)
        self.assertEqual(st['modules']['enabled'], {'acquisition': True, 'trading': True,
                                                    'circulation': True, 'showcase': True})
        self.assertEqual(st['modules']['startPage'], 'domestic')
        self.assertEqual(st['modules']['needsSetup'], False)
        self.assertEqual(len(st['sales']), 2)
        self.assertEqual(len(st['shipments']), 1)

    def test_unknown_cost_is_null_not_zero_and_profit_excluded(self):
        self.assertEqual(self.record('minecraft')['cost'], None)
        self.assertEqual(self.record('moon')['cost'], None)
        self.assertEqual(self.record('remain')['cost'], '49.56')
        sale = self.sale('DEMO-1002')
        profit = {i['recordId']: i['profit'] for i in sale['items']}
        self.assertEqual(profit[self.ids['illinois-en']], '53.69')
        self.assertEqual(profit[self.ids['remain']], '126.84')
        self.assertEqual(profit[self.ids['moon']], None)
        m83 = self.sale('DEMO-1001')
        self.assertEqual(m83['status'], 'shipping')
        self.assertEqual(next(i for i in m83['items'])['profit'], '51.50')

    def test_islands_reference_fixture_starts_without_invented_artwork_or_entity(self):
        self.assertIn('islands-jp', self.ids)
        record = self.record('islands-jp')
        self.assertEqual((record['title'], record['artist'], record['pressing']),
                         ('Islands', 'King Crimson', '日版'))
        self.assertIsNone(record['cost'])
        self.assertEqual(record['photoCount'], 0)
        self.assertFalse(record['cover'])
        self.assertNotIn('barcode', record.get('releaseInfo', {}))
        self.assertNotIn(record['id'], self.store.twin_index()['jobs'])

    def test_allocation_totals_preserved_with_remainder(self):
        s = self.shipment()
        self.assertEqual(s['currency'], 'JPY')
        self.assertEqual(sum(Decimal(i['fee']) for i in s['items']), Decimal(s['cost']))
        self.assertEqual(sum(Decimal(i['feeOriginal']) for i in s['items']),
                         Decimal(s['costOriginal']))
        self.assertEqual([i['fee'] for i in s['items']], ['35.39', '35.38', '35.38'])
        self.assertEqual([i['feeOriginal'] for i in s['items']],
                         ['749.67', '749.67', '749.66'])
        self.assertEqual(self.record('yehui')['fees'], '35.39')
        sale = self.sale('DEMO-1002')
        self.assertEqual(sum(Decimal(i['gross']) for i in sale['items']), Decimal(sale['gross']))
        self.assertEqual(sum(Decimal(i['grossOriginal']) for i in sale['items']),
                         Decimal(sale['grossOriginal']))
        self.assertEqual([i['grossOriginal'] for i in sale['items']],
                         ['4266.67', '4266.67', '4266.66'])

    def test_listed_shipping_and_trash_states(self):
        m83 = self.record('m83')
        self.assertEqual(m83['status'], 'shipping')
        self.assertEqual(m83['listed'], True)
        self.assertTrue(m83.get('saleId'))
        self.assertEqual(m83['listingChannel'], '示例二手平台')
        self.assertEqual(self.record('first-love')['status'], 'trash')

    def test_showcase_group_ordered_members(self):
        groups = self.state()['settings']['showcase-groups-v1']['groups']
        self.assertEqual([g['name'] for g in groups], ['示例精选'])
        self.assertEqual(groups[0]['recordIds'],
                         [self.ids['parachutes'], self.ids['tasogare'], self.ids['loveless']])
        known = {r['id'] for r in self.state()['records']}
        self.assertTrue(set(groups[0]['recordIds']) <= known)

    def test_reseed_is_idempotent(self):
        before = self.state()
        again = self.seed.seed(self.dir)
        self.assertEqual(again, self.ids)
        after = self.state()
        self.assertEqual(len(after['records']), len(before['records']))
        self.assertEqual(len(after['sales']), len(before['sales']))

    def test_guards_refuse_foreign_and_repo_targets(self):
        with self.assertRaises(SystemExit):
            self.seed.seed(ROOT / 'data')
        with tempfile.TemporaryDirectory() as other:
            con = sqlite3.connect(Path(other) / 'albums.sqlite3')
            con.execute('CREATE TABLE meta(key TEXT PRIMARY KEY, data TEXT)')
            con.commit(); con.close()
            with self.assertRaises(SystemExit):
                self.seed.seed(other)


if __name__ == '__main__':
    unittest.main()
