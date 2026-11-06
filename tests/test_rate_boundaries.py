"""Fixed samples prove read/prepare/write separation and date revaluation."""
import tempfile
import unittest
from pathlib import Path
from decimal import Decimal
from domain import ValidationError
from rates import RateService
from tools.seed_samples import seed, open_store


class RateBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.ids=seed(Path(self.tmp.name)/'samples');self.store=open_store(Path(self.tmp.name)/'samples')

    def test_state_is_cache_only_and_unknown_price_does_not_request_quotes(self):
        self.store.rates=RateService(fetch=lambda s,e:self.fail('state must not fetch'))
        state=self.store.state()
        self.assertTrue(any(r['cost'] is None for r in state['records']))
        unknown={r['date'] for r in state['records'] if r['price']==''}
        requested=set(state['rateService']['neededDates'])
        wanted={r['date'] for r in state['records'] if r['currency']=='JPY' and r['price']!='' and r['actual']==''}
        self.assertEqual(requested,wanted)

    def test_future_shipment_never_saves_even_with_cached_past_quote(self):
        before=self.store.backup()
        with self.assertRaisesRegex(ValidationError,'未来'):
            self.store.ship({'ids':[self.ids['loveless']], 'method':'EMS', 'cost':'1000', 'currency':'JPY','date':'2099-01-01'})
        self.assertEqual(self.store.backup()['records'],before['records'])

    def test_date_only_edit_revalues_and_prepared_snapshot_rejects_concurrent_edit(self):
        shipment=self.store.backup()['shipments'][0]
        self.store.rates=RateService(fetch=lambda s,e:{e:'5.0'})
        payload={'id':shipment['id'],'date':'2026-08-21'}
        prepared=self.store.prepare_financial('update_shipment',payload)
        self.store.update_shipment(payload,prepared=prepared)
        after=self.store.backup()['shipments'][0]
        self.assertEqual(after['cost'],'112.45')
        self.assertEqual(after['rateQuote']['quoteDate'],'2026-08-21')
        self.assertEqual(sum(Decimal(i['fee']) for i in after['items']),Decimal('112.45'))
        with self.assertRaisesRegex(ValidationError,'变更'):
            self.store.update_shipment(payload,prepared=prepared)

    def test_prepared_write_cannot_fetch_and_membership_keeps_total(self):
        shipment=self.store.backup()['shipments'][0]
        self.store.rates=RateService(fetch=lambda s,e:{e:'5.0'})
        payload={'id':shipment['id'],'cost':'1000','currency':'JPY'}
        prepared=self.store.prepare_financial('update_shipment',payload)
        self.store.rates.fetch=lambda s,e:self.fail('commit must not fetch')
        self.store.update_shipment(payload,prepared=prepared)
        before=self.store.backup()['shipments'][0]
        self.store.update_shipment({'id':shipment['id'],'add':[self.ids['loveless']]})
        after=self.store.backup()['shipments'][0]
        self.assertEqual(before['cost'],after['cost'])
        self.assertEqual(before['rateQuote'],after['rateQuote'])

    def test_prepared_quote_expiring_before_commit_is_rejected_without_network(self):
        shipment=self.store.backup()['shipments'][0]
        from datetime import date
        clock=[1000]
        self.store.rates=RateService(fetch=lambda s,e:{e:'5.0'},now=lambda:clock[0])
        payload={'id':shipment['id'],'date':date.today().isoformat()}
        prepared=self.store.prepare_financial('update_shipment',payload)
        self.store.rates.fetch=lambda s,e:self.fail('must not refresh under commit lock')
        clock[0]=1301
        with self.assertRaisesRegex(ValidationError,'过期'):
            self.store.update_shipment(payload,prepared=prepared)
        self.assertEqual(self.store.backup()['shipments'][0],shipment)

    def test_financial_http_route_prepares_outside_global_write_lock(self):
        from types import SimpleNamespace
        from server import routes
        def fetch(start, end):
            self.assertFalse(routes.WRITE_LOCK.locked())
            return {end: '4.7'}
        self.store.rates = RateService(fetch=fetch)
        replies = []
        handler = SimpleNamespace(send=lambda body: replies.append(body))
        routes.api_shipments(handler, SimpleNamespace(store=self.store),
                             {'ids': [self.ids['loveless']], 'method': 'EMS', 'currency': 'JPY',
                              'cost': '1000', 'date': '2026-10-01'})
        self.assertIn('id', replies[0])

    def test_cold_csv_export_does_not_fetch(self):
        from types import SimpleNamespace
        from server import routes
        self.store.rates = RateService(fetch=lambda s,e:self.fail('CSV must not fetch'))
        replies = []
        handler = SimpleNamespace(path='/api/export', send=lambda body, **kwargs: replies.append(body))
        routes.api_export(handler, SimpleNamespace(store=self.store))
        self.assertIn('Dookie', replies[0].decode() if isinstance(replies[0], bytes) else replies[0])
