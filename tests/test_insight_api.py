"""采购评估（D-049）：近期加权与比例区间的数学、样本库上的匹配与估算、只读 HTTP 接口与权限。"""
from contextlib import closing, redirect_stdout
from dataclasses import replace
from datetime import date, timedelta
from decimal import Decimal
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import io
import json
from pathlib import Path
import tempfile
import threading
from urllib.parse import urlencode
import unittest

from app import build
from server import make_handler
from server import insight_stats as st
from server.insight_api import clean_candidate, profile, ranking
from server.insight_data import load
from server.insight_model import Model
from server import client_admin as obi_client
from tools.seed_samples import RECORDS, open_store, seed_purchase_review

AS_OF = date(2026, 11, 24)


class StatsTests(unittest.TestCase):
    def test_recency_weight_and_window(self):
        self.assertAlmostEqual(st.weight('2026-05-28', AS_OF, 180), 0.5)
        self.assertAlmostEqual(st.weight('2025-11-29', AS_OF, 180), 0.25, places=2)
        self.assertIsNone(st.weight('2023-11-01', AS_OF, 180))      # older than 36 months
        self.assertIsNone(st.weight('2026-12-01', AS_OF, 180))      # future
        self.assertIsNone(st.weight('', AS_OF, 180))

    def test_weighted_median_neff_and_trend(self):
        self.assertEqual(st.quantile([('10', 1), ('20', 1), ('90', 5)], .5), Decimal(90))
        self.assertEqual(st.quantile([('10', 1), ('20', 1)], .5), Decimal(15))
        self.assertEqual(st.n_eff([(1, 1.0), (2, 1.0)]), 2.0)
        self.assertLess(st.n_eff([(1, 1.0), (2, 0.1)]), 1.3)
        old, new = (AS_OF - timedelta(days=300)).isoformat(), (AS_OF - timedelta(days=10)).isoformat()
        dated = [(old, Decimal(100), 1), (old, Decimal(100), 1), (new, Decimal(118), 1), (new, Decimal(118), 1)]
        self.assertEqual(st.trend(dated, AS_OF), '1.180')
        self.assertIsNone(st.trend(dated[1:], AS_OF))                # each side needs two samples

    def test_ratio_bands(self):
        self.assertEqual(st.band('30'), {'low': '22.00', 'high': '33.00'})
        self.assertEqual(st.band('10'), {'low': '10.00', 'high': '15.00'})
        self.assertEqual(st.band('0'), {'low': '0.00', 'high': '10.00'})
        self.assertEqual(st.band('-30'), {'low': '-33.00', 'high': '-22.00'})
        self.assertEqual(st.band('2500'), {'low': '2000.00', 'high': '3000.00'})
        self.assertEqual(st.summary([('80', 1)]), {'low': '75.00', 'high': '110.00'})
        self.assertIsNone(st.summary([]))

    def test_media_format(self):
        for text, fmt in (('CD', 'CD'), ('SACD', 'CD'), ('12" Vinyl', 'LP'), ('7″', 'LP'), ('LP', 'LP'),
                          ('Cassette', 'other'), ('DVD', 'other'), ('', 'CD')):
            self.assertEqual(st.media_format(text), fmt, text)


class ModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.TemporaryDirectory()
        seed_purchase_review(Path(cls.dir.name))
        cls.ledger = load(open_store(cls.dir.name))

    @classmethod
    def tearDownClass(cls):
        cls.dir.cleanup()

    def model(self, ledger=None, rate=('4.850', '2026-11-24')):
        return Model(ledger or self.ledger, AS_OF, 180, rate)

    def test_release_match_owned_and_landed_cost(self):
        r = self.model().evaluate(clean_candidate({'ref': 'a', 'catalogNumber': 'wpcr 0001', 'format': 'CD',
                                                   'price': '1980', 'currency': 'JPY'}))
        self.assertEqual(r['match'], {'by': 'catalogNumber', 'level': 'release'})
        self.assertEqual(r['owned'], {'held': 1, 'inTransit': 0})
        self.assertEqual(r['history']['costMedian'], st.band(r['history']['costMedian']['low']))  # one copy → range
        parts = r['estimate']['parts']
        self.assertEqual(parts['item'], '96.03')
        self.assertEqual(Decimal(r['estimate']['landedCost']),
                         sum(Decimal(parts[k]) for k in ('item', 'shippingToWarehouse', 'overseasShipping', 'batchFees')))
        self.assertIsNone(r['estimate']['expectedNet'])              # never sold: Agent fills from the market

    def test_album_level_single_sale_is_a_range(self):
        r = self.model().evaluate(clean_candidate({'ref': 'b', 'artist': 'sufjan  stevens', 'title': 'ILLINOIS',
                                                   'format': 'CD', 'price': '2000', 'currency': 'JPY'}))
        self.assertEqual(r['match']['level'], 'album')
        self.assertEqual(r['owned']['held'], 1)                       # the other copy was sold
        h, e = r['history'], r['estimate']
        self.assertEqual((h['bought'], h['sold'], h['listedUnsold']), (2, 1, 1))
        self.assertIsInstance(h['netMedian'], dict)
        self.assertIsNone(h['costRange'])                             # two copies would expose both costs
        self.assertEqual(Decimal(e['expectedProfit']['high']),
                         Decimal(h['netMedian']['high']) - Decimal(e['landedCost']))
        self.assertIsNone(e['expectedMargin'])

    def test_format_split_and_no_match(self):
        m = self.model()
        r = m.evaluate(clean_candidate({'ref': 'c', 'artist': 'Talking Heads', 'title': 'Remain in Light'}))
        self.assertIsNone(r['history'])
        self.assertEqual(list(r['byFormat']), ['LP'])
        r = m.evaluate(clean_candidate({'ref': 'c', 'artist': 'Talking Heads', 'title': 'Remain in Light',
                                        'format': 'CD'}))
        self.assertEqual(r['history']['bought'], 0)                   # the LP never counts for a CD
        r = m.evaluate(clean_candidate({'ref': 'd', 'artist': 'Nobody', 'price': '50', 'currency': 'CNY'}))
        self.assertEqual((r['match']['level'], r['owned'], r['estimate']['landedCost']), ('none', None, '50.00'))

    def test_rate_fallback_and_profile_privacy(self):
        r = self.model(rate=None).evaluate(clean_candidate({'ref': 'a', 'barcode': RECORDS[0][1]['releaseInfo']['barcode'],
                                                            'price': '1000', 'currency': 'JPY'}))
        self.assertEqual(r['match']['by'], 'barcode')
        self.assertEqual(r['estimate']['parts']['rate'], '4.720')    # paid median of the sample rates
        self.assertIn('汇率缓存不可用', ' '.join(r['notes']))
        text = json.dumps(profile(self.model()), ensure_ascii=False)
        for secret in ['DEMO-1002', '示例唱片行', 'Book Off', *(c.id for c in self.ledger.copies)]:
            self.assertNotIn(secret, text)

    def test_ranking_needs_two_sales_and_weights_recent(self):
        sale = next(s for s in self.ledger.sales if s.record.artist_name == 'Sufjan Stevens')
        extra = [replace(sale, date=(AS_OF - timedelta(days=d)).isoformat(), profit=Decimal(p))
                 for d, p in ((5, 120), (8, 120), (400, 10), (420, 10))]
        rows = ranking(self.model(replace(self.ledger, sales=self.ledger.sales + extra)), 'artist', 'artist')
        top = rows[0]
        self.assertEqual((top['artist'], top['format'], top['sold']), ('Sufjan Stevens', 'CD', 5))
        self.assertEqual(top['profitMedian'], '120.00')              # recent sales outweigh the old ones
        self.assertFalse(ranking(self.model(), 'artist', 'artist'))


class InsightHttpTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        seed_purchase_review(self.root)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(build(self.root)))
        threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': 0.04}, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def token(self, name, scope):
        out = io.StringIO()
        with redirect_stdout(out):
            obi_client.main(['--data-dir', str(self.root), 'add', name, '--scope', scope])
        return out.getvalue().strip().splitlines()[-1]

    def request(self, path, token=None, body=None):
        headers = {'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + token} if token else {})}
        with closing(HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)) as conn:
            conn.request('GET' if body is None else 'POST', path, None if body is None else json.dumps(body), headers)
            response = conn.getresponse()
            return response.status, json.loads(response.read()), response.getheader('Cache-Control')

    def test_scope_and_endpoints(self):
        self.assertEqual(self.request('/api/insight/profile')[0], 404)
        reader = self.token('已购查询', 'collection:read')
        buyer = self.token('采购Agent', 'insight:read')
        self.assertEqual(self.request('/api/insight/profile', reader)[0], 403)
        status, data, cache = self.request('/api/insight/profile', buyer)
        self.assertEqual((status, cache), (200, 'no-store'))
        self.assertEqual(set(data), {'asOf', 'weighting', 'costModel', 'turnover', 'top'})
        self.assertEqual(self.request('/api/insight/profile?halfLifeDays=30', buyer)[0], 400)

        good = {'ref': 'x', 'catalogNumber': 'WPCR-0001'}
        status, data, _ = self.request('/api/insight/evaluate', buyer, {'candidates': [good], 'halfLifeDays': 365})
        self.assertEqual((status, data['weighting']['halfLifeDays']), (200, 365))
        self.assertEqual(data['results'][0]['owned'], {'held': 1, 'inTransit': 0})
        for bad in ([], [good] * 2, [{'ref': 'x'}], [{**good, 'price': '1', 'currency': 'USD'}],
                    [{**good, 'price': '-1', 'currency': 'JPY'}], [{**good, 'shop': 'x'}],
                    [{**good, 'ref': str(i)} for i in range(51)]):
            self.assertEqual(self.request('/api/insight/evaluate', buyer, {'candidates': bad})[0], 400, bad[:1])

        query = urlencode({'artist': 'Green Day', 'title': 'Dookie', 'price': '120', 'currency': 'CNY'})
        status, data, _ = self.request('/api/insight/releases?' + query, buyer)
        self.assertEqual((status, data['ref'], data['match']['level']), (200, None, 'album'))
        self.assertEqual(data['owned'], {'held': 2, 'inTransit': 0})
        self.assertEqual(self.request('/api/insight/releases?q=Dookie', buyer)[0], 400)


if __name__ == '__main__':
    unittest.main()
