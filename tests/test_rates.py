"""报价有效性与缓存边界；全部离线、临时缓存，不接触用户数据。"""
import tempfile
import threading
import unittest
from pathlib import Path
from rates import RateService, RateUnavailable


class RateContractTests(unittest.TestCase):
    def service(self, fetch, clock=None, path=None):
        return RateService(path, fetch=fetch, today=lambda: '2026-11-06', now=clock or (lambda: 1000))

    def test_future_and_unverified_old_quotes_are_not_rates(self):
        calls=[]
        svc=self.service(lambda s,e: calls.append((s,e)) or {'2026-11-05':'4.2'})
        svc.mem['2020-01-01']='4.0'
        self.assertIsNone(svc.get('2027-11-06'))
        self.assertEqual(calls,[])
        self.assertIsNone(svc.peek('2026-11-05'))
        self.assertEqual(svc.get('2026-11-05'),'4.2')
        self.assertEqual(svc.quote('2026-11-05')['quoteDate'],'2026-11-05')

    def test_verified_holiday_coverage_survives_restart(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'rates.sqlite3'
            svc=self.service(lambda s,e:{'2026-10-30':'4.2'},path=path)
            self.assertEqual(svc.get('2026-11-01'),'4.2')
            loaded=self.service(lambda s,e:self.fail('verified history must be cached'),path=path)
            self.assertEqual(loaded.get('2026-11-01'),'4.2')
            self.assertEqual(loaded.quote('2026-11-01')['status'],'previous')

    def test_today_expires_even_when_an_exact_quote_exists(self):
        clock=[1000];calls=[]
        svc=self.service(lambda s,e:calls.append(1) or {e:'4.2' if len(calls)==1 else '4.3'},lambda:clock[0])
        self.assertEqual(svc.get('2026-11-06'),'4.2')
        key=svc.cache_key();clock[0]=1301
        self.assertIsNone(svc.peek('2026-11-06'))
        self.assertNotEqual(svc.cache_key(),key)
        self.assertEqual(svc.get('2026-11-06'),'4.3')

    def test_provider_cooldown_covers_other_dates(self):
        calls=[]
        def fetch(s,e):calls.append(1);raise RateUnavailable('down')
        svc=self.service(fetch)
        self.assertIsNone(svc.get('2026-10-01'))
        self.assertIsNone(svc.get('2026-10-02'))
        self.assertEqual(len(calls),1)

    def test_cached_read_does_not_wait_for_network_and_same_day_is_coalesced(self):
        entered=threading.Event();release=threading.Event();calls=[]
        def fetch(s,e):calls.append(1);entered.set();release.wait(2);return {e:'4.2'}
        svc=self.service(fetch);svc.mem['2026-10-01']='4.1'
        threads=[threading.Thread(target=lambda:svc.get('2026-10-02')) for _ in range(2)]
        threads[0].start();self.assertTrue(entered.wait(1));threads[1].start()
        try:self.assertEqual(svc.peek('2026-10-01'),'4.1')
        finally:release.set()
        for t in threads:t.join(2);self.assertFalse(t.is_alive())
        self.assertEqual(len(calls),1)

    def test_invalid_provider_values_and_out_of_window_quotes_are_rejected(self):
        for value in ('NaN','Infinity','-1','0'):
            svc=self.service(lambda s,e:{e:value})
            self.assertIsNone(svc.get('2026-10-01'),value)
        svc=self.service(lambda s,e:{'2020-01-01':'4.5','2027-01-01':'4.9'})
        self.assertIsNone(svc.get('2026-10-01'))

    def test_single_prepare_window_bounds_sparse_queries(self):
        calls=[]
        svc=self.service(lambda s,e:calls.append((s,e)) or {e:'4.2'})
        svc.warm(['2026-01-01','2026-06-01'],max_windows=1)
        self.assertEqual(len(calls),1)
        self.assertIn('2026-06-01',svc.needed_dates(['2026-01-01','2026-06-01']))

    def test_provisional_previous_day_is_not_frozen_after_midnight(self):
        today=['2026-11-06'];clock=[1000];calls=[]
        svc=RateService(fetch=lambda s,e:calls.append(e) or {'2026-11-05':'4.2'},
                        today=lambda:today[0],now=lambda:clock[0])
        self.assertEqual(svc.get('2026-11-06'),'4.2')
        today[0]='2026-11-07'
        self.assertIsNone(svc.peek('2026-11-06'))
        svc.fetch=lambda s,e:{'2026-11-06':'4.3'}
        self.assertEqual(svc.get('2026-11-06'),'4.3')
        self.assertEqual(svc.quote('2026-11-06')['checkedOn'],'2026-11-07')
        today[0]='2026-11-09'
        self.assertEqual(svc.get('2026-11-06'),'4.3')
        self.assertFalse(svc.quote('2026-11-06')['provisional'])

    def test_empty_preparation_has_no_progress_loop(self):
        calls=[]
        svc=self.service(lambda s,e:calls.append(1) or {})
        svc.warm(['2026-10-01'])
        self.assertEqual(svc.needed_dates(['2026-10-01']),[])
        svc.warm(['2026-10-01'])
        self.assertEqual(len(calls),1)

    def test_quote_snapshot_does_not_change_when_cache_updates(self):
        svc=self.service(lambda s,e:{e:'4.2'})
        svc.mem['2026-10-01']='4.1'
        snapshot=svc.snapshot(['2026-10-01'])
        svc.mem['2026-10-01']='4.3'
        self.assertEqual(snapshot['2026-10-01']['rate'],'4.1')
        self.assertEqual(svc.peek('2026-10-01'),'4.3')
