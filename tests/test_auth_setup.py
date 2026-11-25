"""A new HTTPS instance gates its data until the private link is paired once."""
import base64
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory
from threading import Thread
from time import time
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from security import Auth, STEP_SECONDS, totp_code
from server import Services, make_handler
from server.auth_setup import AuthSetup, SetupRejected, SETUP_LIFETIME
from storage import Store

ORIGIN = 'https://setup.example.test'
HOST = 'setup.example.test'


def link_token(setup):
    return parse_qs(urlsplit(setup.path.read_text().strip()).fragment)['token'][0]


def valid_code(key):
    return totp_code(base64.b32decode(key), int(time()) // STEP_SECONDS)


class AuthSetupTests(unittest.TestCase):
    def setUp(self):
        folder = TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.auth = Auth(self.root / 'auth.sqlite3')

    def start(self):
        setup = AuthSetup(self.auth, ORIGIN)
        service = Services(store=Store(self.root / 'albums.sqlite3'), auth=self.auth,
                           auth_setup=setup, public_origin=ORIGIN)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(service))
        Thread(target=self.server.serve_forever, kwargs={'poll_interval': 0.04}, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        return setup

    def request(self, path, body=None, **headers):
        headers.setdefault('Host', HOST)
        if body is not None:
            headers.setdefault('Content-Type', 'application/json')
            headers.setdefault('Origin', ORIGIN)
        with closing(HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)) as client:
            client.request('GET' if body is None else 'POST', path, None if body is None else json.dumps(body), headers)
            response = client.getresponse()
            return response.status, dict(response.getheaders()), response.read()

    def test_https_startup_setup_and_login(self):
        setup = self.start()
        token = link_token(setup)
        self.assertEqual(setup.path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.request('/')[1]['Location'], '/setup')
        self.assertEqual(self.request('/setup')[0], 200)
        self.assertEqual(self.request('/assets/auth-setup.js')[0], 200)
        self.assertEqual(self.request('/api/state')[0], 401)
        self.assertEqual(self.request('/api/login', {'code': '000000'})[0], 503)
        self.assertEqual(self.request('/api/setup', {'token': 'guess'})[0], 403)
        self.assertEqual(self.request('/api/setup', {'token': token}, Origin='http://' + HOST)[0], 403)
        self.assertEqual(self.request('/api/setup', {'token': token}, Origin='https://other.test')[0], 403)
        status, headers, data = self.request('/api/setup', {'token': token})
        self.assertEqual(status, 200)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        code = valid_code(json.loads(data)['key'])
        status, headers, _ = self.request('/api/setup', {'token': token, 'code': code})
        self.assertEqual(status, 200)
        self.assertNotIn('Set-Cookie', headers)
        self.assertFalse(setup.path.exists())
        self.assertEqual(self.request('/')[1]['Location'], '/login')
        self.assertEqual(self.request('/setup')[1]['Location'], '/login#')
        self.assertEqual(self.request('/api/setup', {'token': token, 'code': code})[0], 404)
        status, headers, _ = self.request('/api/login', {'code': code})
        self.assertEqual(status, 200)
        self.assertEqual(self.request('/api/state', Cookie=headers['Set-Cookie'])[0], 200)

    def test_expired_or_exhausted_links_cannot_enroll(self):
        with patch('server.auth_setup.monotonic', return_value=0) as clock:
            expired = AuthSetup(self.auth, ORIGIN)
            expired_token = link_token(expired)
            clock.return_value = SETUP_LIFETIME
            with self.assertRaises(SetupRejected) as error:
                expired.key(expired_token)
            self.assertEqual(error.exception.status, 410)
        setup = AuthSetup(self.auth, ORIGIN)
        token = link_token(setup)
        with self.assertRaises(SetupRejected) as error:
            setup.key(expired_token)
        self.assertEqual(error.exception.status, 403)
        for _ in range(4):
            with self.assertRaisesRegex(ValueError, '6 位'):
                setup.confirm(token, 'not-a-code')
        with self.assertRaises(SetupRejected) as error:
            setup.confirm(token, 'not-a-code')
        self.assertEqual(error.exception.status, 410)
        self.assertFalse(self.auth.configured())

    def test_concurrent_setup_is_single_use_across_servers(self):
        first = AuthSetup(self.auth, ORIGIN)
        first_token = link_token(first)
        second = AuthSetup(self.auth, ORIGIN)
        second_token = link_token(second)
        candidates = [(setup, token, valid_code(setup.key(token)))
                      for setup, token in [(first, first_token), (second, second_token)]]

        def attempt(candidate):
            setup, token, code = candidate
            try:
                setup.confirm(token, code)
            except SetupRejected as error:
                self.assertEqual(error.status, 404)
                return False
            return True

        with ThreadPoolExecutor(max_workers=2) as pool:
            result = list(pool.map(attempt, candidates))
        self.assertEqual(result.count(True), 1)
        self.assertTrue(self.auth.login(candidates[result.index(True)][2]))

    def test_web_setup_never_replaces_legacy_password_owner(self):
        setup = AuthSetup(self.auth, ORIGIN)
        token = link_token(setup)
        key = setup.key(token)
        with closing(sqlite3.connect(self.auth.path)) as db, db:
            db.execute("INSERT INTO owner VALUES ('test-hash', 'test-salt')")
        with self.assertRaises(SetupRejected) as error:
            setup.confirm(token, valid_code(key))
        self.assertEqual(error.exception.status, 404)
