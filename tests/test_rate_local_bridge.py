"""Local quote handoff uses the same validated cache, without an HTTP import API."""
import json
import tempfile
import unittest
from rates import RateService
from server.local_entry import Engine


class LocalRateBridgeTests(unittest.TestCase):
    def test_local_engine_accepts_public_quote_and_rejects_forged_source(self):
        with tempfile.TemporaryDirectory() as directory:
            engine=Engine(directory,seed=False)
            net=RateService(fetch=lambda s,e:{e:'4.7'})
            quote=net.resolve('2026-08-20')
            self.assertIsNone(engine.svc.rates.peek('2026-08-20'))
            engine.accept_rate_quotes(json.dumps([quote]))
            self.assertEqual(engine.svc.rates.peek('2026-08-20'),'4.7')
            legacy = {**quote, 'requestedDate': '2026-08-19', 'quoteDate': '2026-08-19', 'checkedAt': None}
            engine.accept_rate_quotes(json.dumps([legacy]))
            self.assertIsNone(engine.svc.rates.quote('2026-08-19')['checkedAt'])
            self.assertEqual(engine.svc.rates.peek('2026-08-19'),'4.7')
            forged={**quote,'requestedDate':'2026-08-21','quoteDate':'2026-08-21','rate':'9.9','source':'unknown'}
            engine.accept_rate_quotes(json.dumps([forged]))
            self.assertIsNone(engine.svc.rates.peek('2026-08-21'))
            self.assertIsNone(__import__('server.routes',fromlist=['resolve_post']).resolve_post('/api/rates/import'))
