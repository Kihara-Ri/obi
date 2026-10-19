"""官方 OAuth 协议边界；测试钥匙不对应任何 OpenAI 凭据。"""
import base64
import hashlib
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from unittest.mock import patch
from domain import ValidationError
from tests.listing_oauth_key import N, D, E


def encoded(raw): return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()


def signed_token(**changes):
    claims = {'iss': 'https://auth.openai.com', 'aud': 'oaiapp_test', 'sub': 'test-user',
              'exp': int(time.time()) + 600, 'iat': int(time.time()), 'nonce': 'test-nonce', **changes}
    raw = encoded(b'{"alg":"RS256","kid":"test"}') + '.' + encoded(json.dumps(claims).encode())
    digest = bytes.fromhex('3031300d060960864801650304020105000420') + hashlib.sha256(raw.encode()).digest()
    length = (N.bit_length() + 7) // 8
    em = b'\0\1' + b'\xff' * (length - len(digest) - 3) + b'\0' + digest
    return raw + '.' + encoded(pow(int.from_bytes(em, 'big'), D, N).to_bytes(length, 'big'))


class OAuthTests(unittest.TestCase):
    def keys(self):
        return {'keys': [{'kty': 'RSA', 'kid': 'test', 'alg': 'RS256', 'use': 'sig',
                          'n': encoded(N.to_bytes((N.bit_length()+7)//8, 'big')),
                          'e': encoded(E.to_bytes(3, 'big'))}]}

    def test_verifies_signature_issuer_audience_expiry_and_nonce(self):
        from server.chatgpt_identity import verify_identity
        self.assertEqual(verify_identity(signed_token(), 'oaiapp_test', 'test-nonce', self.keys())['sub'], 'test-user')
        for kwargs in ({'nonce': 'wrong'}, {'aud': 'wrong'}, {'iss': 'wrong'}, {'exp': 1}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValidationError):
                verify_identity(signed_token(**kwargs), 'oaiapp_test', 'test-nonce', self.keys())
        with self.assertRaises(ValidationError):
            verify_identity(signed_token()[:-5] + 'AAAAA', 'oaiapp_test', 'test-nonce', self.keys())

    def test_login_fresh_pkce_and_persistent_host_id_and_no_token_leak(self):
        from server.chatgpt_auth import ChatGPTAuth
        with tempfile.TemporaryDirectory() as directory:
            auth = ChatGPTAuth(Path(directory))
            first = auth.start()
            params = parse_qs(urlsplit(first['url']).query)
            self.assertEqual(params['client_id'], ['dynamic_agent_client'])
            self.assertEqual(params['scope'], ['openid profile email offline_access resource.invoke chatgpt.tokens.use.direct'])
            self.assertEqual(params['code_challenge_method'], ['S256'])
            self.assertTrue(params['redirect_uri'][0].startswith('http://127.0.0.1:'))
            auth.cancel()
            host = auth.status()['hostId']
            second = auth.start()
            self.assertNotEqual(parse_qs(urlsplit(second['url']).query)['state'], params['state'])
            auth.cancel()
            self.assertEqual(ChatGPTAuth(Path(directory)).status()['hostId'], host)
            self.assertNotIn('access_token', json.dumps(auth.status()))

    def test_wrong_state_or_missing_issued_client_rejected(self):
        from server.chatgpt_auth import ChatGPTAuth
        with tempfile.TemporaryDirectory() as directory:
            auth = ChatGPTAuth(Path(directory))
            url = auth.start()['url']; state = parse_qs(urlsplit(url).query)['state'][0]
            with self.assertRaises(ValidationError): auth.finish({'state': ['bad'], 'code': ['x']})
            with self.assertRaises(ValidationError): auth.finish({'state': [state], 'code': ['x']})
            self.assertFalse(auth.status()['connected'])
            auth.cancel()

    def test_refresh_replaces_rotating_credentials_atomically(self):
        from server.chatgpt_credentials import Credentials
        with tempfile.TemporaryDirectory() as directory:
            credentials = Credentials(Path(directory))
            with credentials.locked() as state:
                state['accounts']['test'] = {'client_id': 'oaiapp_test', 'access_token': 'old',
                    'refresh_token': 'old-refresh', 'expires_at': 1, 'subject': 'test-user',
                    'scopes': ['chatgpt.tokens.use.direct']}
                state['active'] = 'test'
            with patch('server.chatgpt_credentials.token_request', return_value={
                    'access_token': 'new', 'refresh_token': 'new-refresh', 'expires_in': 3600,
                    'scope': 'chatgpt.tokens.use.direct', 'token_type': 'Bearer'}):
                self.assertEqual(credentials.access_token(), 'new')
            with credentials.locked() as state:
                self.assertEqual(state['accounts']['test']['refresh_token'], 'new-refresh')
            self.assertEqual(credentials.path.stat().st_mode & 0o777, 0o600)

    def test_login_stays_pending_during_slow_token_exchange(self):
        from server.chatgpt_auth import ChatGPTAuth
        entered, release = threading.Event(), threading.Event()
        def exchange(fields):
            entered.set(); release.wait(3)
            return {'access_token': 'access', 'refresh_token': 'refresh', 'id_token': 'id',
                    'expires_in': 3600, 'token_type': 'Bearer', 'scope': 'chatgpt.tokens.use.direct'}
        with tempfile.TemporaryDirectory() as directory:
            auth = ChatGPTAuth(Path(directory))
            params = parse_qs(urlsplit(auth.start()['url']).query)
            with patch('server.chatgpt_auth.token_request', side_effect=exchange), \
                    patch('server.chatgpt_auth.request', return_value={}), \
                    patch('server.chatgpt_auth.verify_identity', return_value={'sub': 'user'}):
                worker = threading.Thread(target=lambda: auth.finish({
                    'state': params['state'], 'code': ['code'], 'client_id': ['oaiapp_test']}))
                worker.start(); self.assertTrue(entered.wait(2))
                pending = auth.status()['loginPending']
                release.set(); worker.join()
                self.assertTrue(pending, 'token exchange must remain observable as pending')
                self.assertTrue(auth.status()['connected'])
                self.assertFalse(auth.status()['loginPending'])

    def test_server_import_keeps_its_host_and_selects_imported_account(self):
        from server.chatgpt_auth import ChatGPTAuth
        from server.chatgpt_cli import import_credentials
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            auth = ChatGPTAuth(folder / 'server')
            host = auth.status()['hostId']
            source = folder / 'transfer.json'
            source.write_text(json.dumps({'hostId': 'laptop-host', 'active': 'test', 'accounts': {'test': {
                'client_id': 'oaiapp_test', 'subject': 'user', 'access_token': 'access',
                'refresh_token': 'refresh', 'expires_at': time.time() + 600,
                'scopes': ['chatgpt.tokens.use.direct']}}}))
            import_credentials(auth, source)
            status = auth.status()
            self.assertEqual(status['hostId'], host)
            self.assertEqual(status['active'], 'test')
            self.assertTrue(status['connected'])
