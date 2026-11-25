"""TOTP compatibility, session migration, and shared replay/throttle state."""
import hashlib
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from auth_fixture import TEST_SECRET
from security import Auth, LoginThrottled, TotpRequired, totp_code


class AuthTests(unittest.TestCase):
    def setUp(self):
        root = TemporaryDirectory()
        self.addCleanup(root.cleanup)
        self.path = Path(root.name) / 'auth.sqlite3'
        self.now = 1_234_567_890
        clock = patch('security.time', side_effect=lambda: self.now)
        clock.start()
        self.addCleanup(clock.stop)
        self.auth = Auth(self.path)

    def code(self, shift=0, secret=TEST_SECRET):
        return totp_code(secret, self.now // 30 + shift)

    def enroll(self):
        self.auth.enroll_totp(TEST_SECRET, self.code())

    def session(self):
        return 'album_session=' + self.auth.login(self.code())

    def wrong_code(self):
        return next(code for code in ('000000', '111111', '222222') if code not in (self.code(), self.code(-1)))

    def test_rfc6238_sha1_six_digit_suffixes(self):
        for stamp, code in ((59, '287082'), (1111111109, '081804'), (1111111111, '050471'),
                            (1234567890, '005924'), (2000000000, '279037'), (20000000000, '353130')):
            self.assertEqual(totp_code(TEST_SECRET, stamp // 30), code)

    def test_rollover_and_replay_survive_restart(self):
        self.enroll()
        with self.assertRaisesRegex(ValueError, '已过期'):
            self.auth.login(self.code(-2))
        with self.assertRaisesRegex(ValueError, '已过期'):
            self.auth.login(self.code(1))
        self.auth.login(self.code(-1))
        session = self.session()
        restarted = Auth(self.path)
        self.assertTrue(restarted.valid(session))
        self.now += 30
        with self.assertRaisesRegex(ValueError, '已使用'):
            restarted.login(self.code(-1))
        self.assertTrue(restarted.valid(self.session()))

    def test_concurrent_reuse_only_mints_one_session(self):
        self.enroll()
        code = self.code()

        def try_login(_):
            try:
                return self.auth.login(code)
            except ValueError:
                return None

        with ThreadPoolExecutor(max_workers=2) as pool:
            tokens = list(pool.map(try_login, range(2)))
        self.assertEqual(sum(token is not None for token in tokens), 1)

    def test_throttle_is_shared_persistent_and_expires(self):
        self.enroll()
        with self.assertRaises(ValueError):
            self.auth.login(self.wrong_code())
        self.now += 901
        for _ in range(4):
            with self.assertRaisesRegex(ValueError, '已过期'):
                self.auth.login(self.wrong_code())
        with self.assertRaises(LoginThrottled):
            self.auth.login(self.wrong_code())
        self.now += 1
        with self.assertRaises(LoginThrottled) as context:
            Auth(self.path).login(self.code())
        self.assertEqual(context.exception.retry_after, 899)
        self.now += 899
        self.assertTrue(self.auth.valid(self.session()))

    def test_legacy_owner_stays_gated_until_enrollment(self):
        self.assertFalse(self.auth.configured())
        legacy_digest = hashlib.sha256(b'legacy-token').hexdigest()
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute("INSERT INTO owner VALUES ('old-hash', 'old-salt')")
            db.execute('INSERT INTO sessions VALUES (?, ?)', (legacy_digest, self.now + 30))
        self.assertTrue(self.auth.configured())
        self.assertFalse(self.auth.valid('album_session=legacy-token'))
        with self.assertRaises(TotpRequired):
            self.auth.login(self.code())
        with self.assertRaisesRegex(ValueError, '已过期'):
            self.auth.enroll_totp(TEST_SECRET, self.wrong_code())
        self.enroll()
        self.assertTrue(self.auth.valid(self.session()))
        with closing(sqlite3.connect(self.path)) as db, db:
            row = db.execute('SELECT hash FROM owner').fetchone()
            self.assertNotEqual(row[0], 'old-hash')
            # Even a session minted after a rollback uses the old hash format.
            db.execute('INSERT INTO sessions VALUES (?, ?)', (legacy_digest, self.now + 30))
        self.assertFalse(self.auth.valid('album_session=legacy-token'))

    def test_verified_reset_revokes_other_secrets_and_sessions(self):
        self.enroll()
        session_a = self.session()
        self.now += 30
        session_b = self.session()
        new_secret = bytes(range(20))
        with self.assertRaisesRegex(ValueError, '已过期'):
            self.auth.enroll_totp(new_secret, '999999')
        self.assertTrue(self.auth.valid(session_a))
        self.auth.enroll_totp(new_secret, self.code(secret=new_secret))
        self.assertFalse(self.auth.valid(session_a))
        self.assertFalse(self.auth.valid(session_b))
        with self.assertRaises(ValueError):
            self.auth.login(self.code())
        new_token = self.auth.login(self.code(secret=new_secret))
        self.assertTrue(self.auth.valid('album_session=' + new_token))

    def test_session_renews_on_use_and_expires_after_idle(self):
        self.enroll()
        session = self.session()
        self.now += 20 * 86400
        self.assertTrue(self.auth.valid(session))
        self.now += 14 * 86400
        self.assertTrue(self.auth.valid(session))
        self.now += 16 * 86400
        self.assertFalse(self.auth.valid(session))
