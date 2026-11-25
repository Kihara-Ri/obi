"""Independent HTTP clients can search confirmed purchases with a read-only credential."""
from contextlib import closing
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import secrets
import tempfile
import threading
from urllib.parse import urlencode
import unittest
from unittest.mock import patch

from app import build
from server import make_handler
from tools.seed_samples import seed_purchase_review


PURCHASES = '/api/collection/purchases'


class PurchaseQueryTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.ids = seed_purchase_review(self.root)
        credentials = self.root / 'credentials'
        credentials.mkdir(mode=0o700)
        self.tokens = {}
        for name, kind in (('collection-read', 'collection'), ('listing-agent', 'listing'),
                           ('trading-agent', 'trading')):
            token = f'obi_{kind}_' + secrets.token_urlsafe(32)
            self.tokens[kind] = token
            path = credentials / (name + '.token')
            path.write_text(token + '\n')
            path.chmod(0o600)
        self.services = build(self.root)
        self.services.auth.set_password('sample-purchase-query-password')
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(self.services))
        threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': 0.04}, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def request(self, path, token=None, *, body=None, origin=None, cookie=None):
        headers = {'Content-Type': 'application/json'}
        if token is not None:
            headers['Authorization'] = 'Bearer ' + token
        if origin is not None:
            headers['Origin'] = origin
        if cookie is not None:
            headers['Cookie'] = 'album_session=' + cookie
        with closing(HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)) as conn:
            conn.request('GET' if body is None else 'POST', path, body, headers)
            response = conn.getresponse()
            return response.status, json.loads(response.read()), dict(response.getheaders())

    def search(self, term, **params):
        url = PURCHASES + '?' + urlencode({'q': term, **params})
        status, data, headers = self.request(url, self.tokens['collection'])
        self.assertEqual(status, 200, data)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertTrue(headers['Content-Type'].startswith('application/json'))
        return data

    def test_authentication_and_existing_scopes_are_isolated(self):
        path = PURCHASES + '?q=Moon'
        for token in (None, 'wrong', self.tokens['listing'], self.tokens['trading']):
            status, _, headers = self.request(path, token)
            self.assertEqual(status, 401)
            self.assertEqual(headers['WWW-Authenticate'], 'Bearer')
        cookie = self.services.auth.login('sample-purchase-query-password', '127.0.0.1')
        self.assertEqual(self.request(path, cookie=cookie)[0], 401)
        token = self.tokens['collection']
        self.assertEqual(self.request(path, token, origin='https://other.test')[0], 403)
        for target in ('/api/state', '/api/backup', '/api/listing/agent/package?q=Moon',
                       f'/api/photo/{self.ids["dsotm-jp"]}/0'):
            self.assertEqual(self.request(target, token)[0], 401, target)
        for target in ('/api/records', '/api/listing/agent/receipts', '/api/trading/agent/orders',
                       '/api/trading/agent/settlements'):
            self.assertEqual(self.request(target, token, body='{}')[0], 401, target)
        self.assertEqual(self.request(PURCHASES, token, body='{}')[0], 404)

    def test_purchase_statuses_and_historical_records(self):
        copies = self.search('illinois')['copies']
        self.assertCountEqual([row['status'] for row in copies], ['held', 'resold'])
        self.assertEqual(self.search('Sufjan Stevens', status='held')['copies'],
                         [next(row for row in copies if row['status'] == 'held')])
        for term, expected in (('周杰伦 叶惠美', 'in_transit'), ('The Microphones', 'sale_pending'),
                               ('Life Continues', 'removed')):
            rows = self.search(term)['copies']
            self.assertEqual([row['status'] for row in rows], [expected])

    def test_only_confirmed_purchases_are_returned(self):
        self.assertEqual(self.search('Minecraft')['copies'], [])   # Date and channel alone are insufficient.
        self.assertEqual(self.search('Carrie & Lowell')['copies'], [])    # A sale does not prove a purchase.
        self.assertEqual(self.search('Crimson King')['copies'][0]['status'], 'held')  # Actual outlay without price.
        self.assertIsNone(self.search('Crimson King')['copies'][0]['format'])  # Mini LP Sleeve is packaging.

    def test_exact_release_search_and_response_allowlist(self):
        before = self.services.store.fingerprint()
        with patch.object(self.services.store, 'state', side_effect=AssertionError('full ledger read')):
            copy, = self.search('tocp0002', by='catalogNumber')['copies']
            self.assertEqual(self.search(copy['barcode'], by='barcode')['copies'], [copy])
            self.assertEqual(self.search('TOCP', by='catalogNumber')['copies'], [])
            vinyl, = self.search('DEMO-LP-0001', by='catalogNumber')['copies']
        self.assertEqual(self.services.store.fingerprint(), before)
        self.assertEqual(copy, {'artist': 'Pink Floyd', 'title': 'Wish You Were Here', 'status': 'held',
                                'format': 'CD', 'version': 'Jewel Case', 'pressing': '日版',
                                'obi': '带侧标', 'country': 'JP', 'catalogNumber': 'TOCP-0002 / TOCP-0002 / TOCP-0002',
                                'barcode': copy['barcode'], 'edition': None})
        self.assertEqual(vinyl, {'artist': 'Talking Heads', 'title': 'Remain In Light', 'status': 'resold',
                                 'format': '12" Vinyl', 'version': 'Jewel Case', 'pressing': '外版', 'obi': None,
                                 'country': None, 'catalogNumber': 'DEMO-LP-0001', 'barcode': None, 'edition': '示例再版'})

    def test_validation_and_paging(self):
        token = self.tokens['collection']
        for query in ('', 'q=+++', 'q=Moon&status=domestic', 'q=Moon&by=unknown',
                      'q=Moon&offset=-1', 'q=Moon&offset=invalid', 'q=Moon&photos=1',
                      'q=WPCR-0001+%2F+WPCR-0002&by=catalogNumber'):
            self.assertEqual(self.request(PURCHASES + '?' + query, token)[0], 400, query)
        with patch('server.collection_api.PAGE_SIZE', 1):
            first = self.search('dark side of the moon')
            self.assertEqual(first['nextOffset'], 1)
            second = self.search('DARK SIDE OF THE MOON', offset=first['nextOffset'])
            self.assertIsNone(second['nextOffset'])
            self.assertNotEqual(first['copies'], second['copies'])
            self.assertEqual(self.search('dark side of the moon', offset=2), {'copies': [], 'nextOffset': None})

    def test_disabling_bookkeeping_modules_preserves_existing_purchases(self):
        before = self.search('Illinois')
        self.services.store.set_modules(dict(acquisition=False, circulation=False, trading=False, showcase=False))
        self.assertEqual(self.search('Illinois'), before)

    def test_disabling_credential_takes_effect_when_loaded_again(self):
        (self.root / 'credentials' / 'collection-read.token').unlink()
        self.services.collection_read_secret = build(self.root).collection_read_secret
        self.assertEqual(self.request(PURCHASES + '?q=Moon', self.tokens['collection'])[0], 404)
