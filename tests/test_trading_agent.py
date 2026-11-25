"""固定样本经过实际 HTTP 鉴权、上架、订单和账本结算。"""
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
import json
import secrets
import tempfile
import threading
import unittest

from app import build
from domain import ConflictError
from server import make_handler
from storage import Store
from tools.seed_samples import seed


RECEIPTS = '/api/listing/agent/receipts'
ORDERS = '/api/trading/agent/orders'
SETTLEMENTS = '/api/trading/agent/settlements'
ITEM = '100000000001'
ORDER = 'DEMO-XIANYU-001'
PAYMENT = {'orderId': ORDER, 'itemId': ITEM, 'date': '2026-10-09', 'gross': '90.00',
           'fees': '3.00', 'postage': '7.00'}
SETTLED = '2026-10-14'


class TradingAgentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.ids = seed(root)
        credentials = root / 'credentials'
        credentials.mkdir()
        self.trade_token = 'obi_trading_' + secrets.token_urlsafe(32)
        self.draft_token = 'obi_listing_' + secrets.token_urlsafe(32)
        (credentials / 'trading-agent.token').write_text(self.trade_token + '\n')
        (credentials / 'listing-agent.token').write_text(self.draft_token + '\n')
        self.services = build(root)
        self.store = self.services.store
        self.services.auth.set_password('sample-trading-agent-password')
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(self.services))
        threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': 0.04}, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def request(self, path, data=None, *, token=None, origin=None):
        with closing(HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)) as conn:
            headers = {'Content-Type': 'application/json'}
            if token is not None:
                headers['Authorization'] = 'Bearer ' + token
            if origin:
                headers['Origin'] = origin
            conn.request('GET' if data is None else 'POST', path,
                         json.dumps(data) if data is not None else None, headers)
            response = conn.getresponse()
            return response.status, json.loads(response.read())

    def post(self, path, data, status=200):
        actual, body = self.request(path, data, token=self.trade_token)
        self.assertEqual(actual, status, body)
        return body

    def record(self, key='lift-fists'):
        return next(r for r in self.store.backup()['records'] if r['id'] == self.ids[key])

    def receipt(self, key='lift-fists', **fields):
        record = self.record(key)
        return {'id': record['id'], 'revision': record['revision'], 'itemId': ITEM,
                'status': 'online', 'price': '95.00', 'shipping': {'mode': 'free'},
                'verifiedAt': '2026-10-08T05:30:00Z', **fields}

    def test_explicit_token_scope_and_module_gate(self):
        data = self.receipt()
        for route in (RECEIPTS, ORDERS, SETTLEMENTS):
            self.assertEqual(self.request(route, {}, token=self.draft_token)[0], 401)
            self.assertEqual(self.request(route, {})[0], 401)
        self.assertEqual(self.request('/api/state', token=self.trade_token)[0], 401)
        self.assertEqual(self.request('/api/bulk', {}, token=self.trade_token)[0], 401)
        self.assertEqual(self.request('/api/listing/agent/package?q=Moon', token=self.trade_token)[0], 401)
        self.assertEqual(self.request(RECEIPTS, data, token=self.trade_token, origin='https://other.test')[0], 403)
        self.store.set_modules(dict(acquisition=True, trading=False, circulation=True, showcase=True))
        self.post(RECEIPTS, data, 400)
        self.services.trading_agent_secret = None
        self.post(RECEIPTS, data, 404)

    def test_receipt_and_sale_only_complete_after_both_facts(self):
        data = self.receipt()
        self.post(RECEIPTS, {**data, 'status': 'accepted'}, 400)
        self.assertFalse(self.record().get('listed'))
        receipt = self.post(RECEIPTS, data)
        self.assertEqual(receipt, self.post(RECEIPTS, {**data, 'price': '95'}))
        self.assertEqual(self.record()['revision'], data['revision'] + 1)
        self.assertEqual(self.record()['listingChannel'], '闲鱼')
        self.assertEqual(self.record()['listingUrl'], receipt['url'])

        sale = self.post(ORDERS, PAYMENT)
        self.assertEqual(sale['status'], 'shipping')
        self.assertEqual(self.record()['status'], 'shipping')
        self.assertEqual(self.post(ORDERS, PAYMENT), sale)
        buyer_event = {'orderId': ORDER, 'buyerReceived': True}
        self.assertEqual(self.post(SETTLEMENTS, buyer_event)['status'], 'shipping')
        self.assertEqual(self.record()['status'], 'shipping')
        settlement = self.post(SETTLEMENTS, {'orderId': ORDER, 'settledDate': SETTLED})
        self.assertEqual(settlement['status'], 'complete')
        self.assertEqual(self.post(SETTLEMENTS, buyer_event), settlement)
        self.assertEqual(self.post(ORDERS, PAYMENT), settlement)
        self.assertEqual(self.record()['status'], 'sold')
        final = next(s for s in self.store.state()['sales'] if s['id'] == sale['saleId'])
        self.assertEqual((final['receivedDate'], final['items'][0]['net']), (SETTLED, '80.00'))
        actions = [r['action'] for r in self.store.backup()['audit']]
        self.assertEqual(actions.count('销售 receive'), 2)  # 样本已有一笔

    def test_editing_listing_details_preserves_receipt_time_and_product_owner(self):
        receipt = self.post(RECEIPTS, self.receipt())
        self.store.bulk({'action': 'list', 'ids': [self.ids['dsotm-jp']]})
        def order():
            return {r['id']: r.get('listingOrder') for r in self.store.state()['records'] if r.get('listed')}

        before = order()
        self.store.save_listing_details({'mode': 'edit', 'entries': [
            {'id': self.ids['lift-fists'], 'revision': receipt['revision'],
             'channel': '示例二手平台', 'url': 'https://example.com/listings/copy'}]})
        self.assertEqual(order(), before)
        other = self.record('minecraft')
        with self.assertRaises(ConflictError):
            self.store.save_listing_details({'mode': 'list', 'entries': [
                {'id': other['id'], 'revision': other['revision'], 'channel': '闲鱼', 'url': receipt['url']}]})
        self.post(ORDERS, PAYMENT, 409)

    def test_duplicate_order_and_out_of_order_events(self):
        self.post(RECEIPTS, self.receipt())
        with ThreadPoolExecutor() as pool:
            a, b = pool.map(lambda _: self.post(ORDERS, PAYMENT), range(2))
        self.assertEqual(a, b)
        self.post(ORDERS, {**PAYMENT, 'gross': '99'}, 409)
        self.post(SETTLEMENTS, {'orderId': ORDER, 'settledDate': '2026-10-05'}, 409)
        paid = self.post(SETTLEMENTS, {'orderId': ORDER, 'settledDate': SETTLED})
        self.assertFalse(paid['buyerReceived'])
        self.assertEqual(paid['status'], 'shipping')
        self.store.update_sale({'id': a['saleId'], 'fees': '4.50'})
        self.assertEqual(self.post(ORDERS, PAYMENT), paid)
        self.assertEqual(self.post(SETTLEMENTS, {'orderId': ORDER, 'buyerReceived': True})['status'], 'complete')
        final = next(s for s in self.store.state()['sales'] if s['id'] == a['saleId'])
        self.assertEqual(final['fees'], '4.50')

    def test_existing_links_and_stale_receipts(self):
        data = self.receipt()
        rid = data['id']
        self.store.bulk({'ids': [rid], 'action': 'list', 'listing': {
            'channel': '闲鱼', 'url': 'https://www.goofish.com/item?id=' + ITEM}})
        self.post(RECEIPTS, data, 409)
        data = self.receipt()
        self.post(RECEIPTS, self.receipt('spiderland'), 409)
        self.post(RECEIPTS, data)
        self.store.bulk({'ids': [rid], 'action': 'unlist'})
        self.assertFalse(self.post(RECEIPTS, data)['listed'])
        self.post(ORDERS, PAYMENT, 409)

    def test_existing_order_settles_and_cancelled_order_stays_cancelled(self):
        sale_id = self.store.sell({'ids': [self.ids['lift-fists']], 'currency': 'CNY',
                                   'channel': '闲鱼', **PAYMENT})['id']
        event = {'orderId': ORDER, 'buyerReceived': True, 'settledDate': SETTLED}
        self.store.sale_action({'id': sale_id, 'action': 'cancel'})
        self.post(SETTLEMENTS, event, 409)
        order_id = 'DEMO-XIANYU-002'
        other_id = self.store.sell({'ids': [self.ids['lift-fists']], 'currency': 'CNY',
                                    'channel': '闲鱼', **PAYMENT, 'orderId': order_id})['id']
        self.assertEqual(self.post(SETTLEMENTS, {**event, 'orderId': order_id})['saleId'], other_id)

    def test_backup_preserves_receipt_and_pending_facts(self):
        data = self.receipt()
        receipt = self.post(RECEIPTS, data)
        sale = self.post(ORDERS, PAYMENT)
        self.post(SETTLEMENTS, {'orderId': ORDER, 'buyerReceived': True})
        copy = Store(Path(self.tmp.name) / 'restored' / 'albums.sqlite3')
        copy.restore_backup(self.store.backup())
        self.assertEqual(copy.record_xianyu_listing(data)['url'], receipt['url'])
        self.assertEqual(copy.record_xianyu_order(PAYMENT)['saleId'], sale['saleId'])
        settled = copy.record_xianyu_settlement({'orderId': ORDER, 'settledDate': SETTLED})
        self.assertEqual(settled['status'], 'complete')

    def test_refund_clears_partial_settlement_facts(self):
        self.post(RECEIPTS, self.receipt())
        sale = self.post(ORDERS, PAYMENT)
        self.post(SETTLEMENTS, {'orderId': ORDER, 'settledDate': SETTLED})
        self.store.sale_action({'id': sale['saleId'], 'action': 'refund', 'refund': '90', 'date': SETTLED})
        self.post(SETTLEMENTS, {'orderId': ORDER, 'buyerReceived': True}, 409)
        self.store.sale_action({'id': sale['saleId'], 'action': 'undo_refund'})
        response = self.post(SETTLEMENTS, {'orderId': ORDER, 'buyerReceived': True})
        self.assertEqual(response['status'], 'shipping')
        self.assertIsNone(response['settledDate'])
