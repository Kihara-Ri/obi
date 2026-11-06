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

    def test_shared_quote_day_never_rolls_back_across_batches_or_restart(self):
        from pathlib import Path
        from rate_provider import SOURCE
        def quote(day, rate, checked):
            return {'requestedDate': day, 'quoteDate': '2026-11-05', 'rate': rate,
                    'checkedAt': checked, 'source': SOURCE, 'provisional': True,
                    'status': 'previous' if day.endswith('06') else 'exact', 'checkedOn': '2026-11-06'}
        newer, older = quote('2026-11-06', '4.3', 1150), quote('2026-11-05', '4.2', 1000)
        for batch in ([newer, older], [older, newer]):
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / 'rates.sqlite3'
                svc = RateService(path, today=lambda: '2026-11-06', now=lambda: 1200)
                svc.accept_quotes(batch)
                self.assertEqual(svc.peek('2026-11-06'), '4.3')
                svc = RateService(path, today=lambda: '2026-11-06', now=lambda: 1200)
                svc.accept_quotes([older])
                self.assertEqual(svc.peek('2026-11-06'), '4.3')
                self.assertEqual(svc.quote('2026-11-05')['valueCheckedAt'], 1150)
                target = RateService(today=lambda: '2026-11-06', now=lambda: 1200)
                target.accept_quotes([svc.quote('2026-11-05'), newer])
                self.assertEqual(target.peek('2026-11-06'), '4.3')

    def test_provider_value_survives_an_older_other_day_handoff(self):
        svc = RateService(fetch=lambda s,e: {'2026-11-05': '4.3'},
                          today=lambda: '2026-11-06', now=lambda: 1200)
        newer = svc.resolve('2026-11-06')
        svc.accept_quotes([{**newer, 'requestedDate': '2026-11-05', 'status': 'exact',
                            'rate': '4.2', 'checkedAt': 1000, 'valueCheckedAt': 1000}])
        self.assertEqual(svc.peek('2026-11-06'), '4.3')
