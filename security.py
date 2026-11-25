"""Single-owner TOTP, persistent hashed sessions, and account-wide login throttling."""
import hashlib
import hmac
import math
import re
import secrets
import sqlite3
from contextlib import closing
from http.cookies import CookieError, SimpleCookie
from time import time

STEP_SECONDS = 30
SESSION_SECONDS = 30 * 86400
FAILURE_LIMIT = 5
LOCK_SECONDS = 15 * 60


class TotpRequired(ValueError):
    """The owner has not enrolled an authenticator yet."""


class AlreadyConfigured(ValueError):
    """First-run enrollment cannot replace an existing owner."""


class LoginThrottled(ValueError):
    def __init__(self, retry_after):
        self.retry_after = math.ceil(retry_after)
        super().__init__(f'尝试次数过多，请 {math.ceil(retry_after / 60)} 分钟后再试')


def totp_code(secret, step):
    """Google Authenticator defaults: HMAC-SHA1, six ASCII digits, 30-second steps."""
    digest = hmac.digest(secret, step.to_bytes(8, 'big'), 'sha1')
    offset = digest[-1] & 0x0f
    number = int.from_bytes(digest[offset:offset + 4], 'big') & 0x7fffffff
    return f'{number % 1_000_000:06d}'


def _matching_step(secret, code, now, last_step=-1):
    current = int(now) // STEP_SECONDS
    # Accept the previous interval for codes entered as the display rolls over.
    for step in (current, current - 1):
        if step > last_step and hmac.compare_digest(totp_code(secret, step), code):
            return step
    return None


def _check_code_format(code):
    if not isinstance(code, str) or not re.fullmatch(r'[0-9]{6}', code):
        raise ValueError('请输入 6 位动态码')


def _token_hash(token):
    # A session issued by an older binary during rollback must never work here.
    return hashlib.sha256(b'totp:' + token.encode()).hexdigest()


def _configured(db):
    return bool(db.execute('SELECT EXISTS(SELECT 1 FROM owner) OR EXISTS(SELECT 1 FROM owner_totp)').fetchone()[0])


class Auth:
    def __init__(self, path):
        self.path = path
        with closing(sqlite3.connect(path)) as db, db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS owner(hash TEXT, salt TEXT);
                CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, expires REAL);
                CREATE TABLE IF NOT EXISTS owner_totp(
                    id INTEGER PRIMARY KEY CHECK(id = 1),
                    secret BLOB NOT NULL,
                    last_step INTEGER NOT NULL DEFAULT -1,
                    failures INTEGER NOT NULL DEFAULT 0,
                    retry_until REAL NOT NULL DEFAULT 0
                );
            ''')

    def configured(self):
        """Keep the gate closed for installations that only have a legacy password."""
        with closing(sqlite3.connect(self.path)) as db:
            return _configured(db)

    def enroll_totp(self, secret, code, *, first_setup=False):
        _check_code_format(code)
        if _matching_step(secret, code, time()) is None:
            raise ValueError('动态码不正确或已过期')
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute('BEGIN IMMEDIATE')
            if first_setup and _configured(db):
                raise AlreadyConfigured('首次绑定已关闭')
            db.execute('INSERT OR REPLACE INTO owner_totp (id, secret) VALUES (1, ?)', (secret,))
            db.execute('DELETE FROM sessions')
            # Older binaries use this row to enable authentication. Replace the
            # old password digest with an unusable value so rollback stays gated.
            db.execute('DELETE FROM owner')
            db.execute('INSERT INTO owner VALUES (?, ?)', (secrets.token_hex(32), secrets.token_hex(16)))

    def login(self, code):
        _check_code_format(code)
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT secret, last_step, failures, retry_until FROM owner_totp WHERE id=1').fetchone()
            if row is None:
                raise TotpRequired('请先在服务器绑定 Google Authenticator')
            secret, last_step, failures, retry_until = row
            now = time()
            if retry_until <= now:
                failures = 0
            if failures == FAILURE_LIMIT:
                raise LoginThrottled(retry_until - now)

            step = _matching_step(secret, code, now, last_step)
            if step is None:
                failures += 1
                if failures in (1, FAILURE_LIMIT):
                    retry_until = now + LOCK_SECONDS
                db.execute('UPDATE owner_totp SET failures=?, retry_until=? WHERE id=1', (failures, retry_until))
                db.commit()
                if failures == FAILURE_LIMIT:
                    raise LoginThrottled(LOCK_SECONDS)
                raise ValueError('动态码不正确、已过期或已使用')

            # Consume the time step and mint the session in one transaction,
            # including when two requests arrive concurrently.
            db.execute('UPDATE owner_totp SET last_step=?, failures=0, retry_until=0 WHERE id=1', (step,))
            db.execute('DELETE FROM sessions WHERE expires<?', (now,))
            token = secrets.token_urlsafe(32)
            db.execute('INSERT INTO sessions VALUES (?, ?)', (_token_hash(token), now + SESSION_SECONDS))
            return token

    def token(self, cookie):
        try:
            parsed = SimpleCookie(cookie or '')
            return parsed['album_session'].value if 'album_session' in parsed else ''
        except CookieError:
            return ''

    def valid(self, cookie):
        token = self.token(cookie)
        if not token:
            return False
        now = time()
        digest = _token_hash(token)
        with closing(sqlite3.connect(self.path)) as db, db:
            row = db.execute(
                'SELECT expires FROM sessions WHERE token=? AND expires>? AND EXISTS(SELECT 1 FROM owner_totp)',
                (digest, now),
            ).fetchone()
            if not row:
                return False
            if row[0] - now < SESSION_SECONDS / 2:
                db.execute('UPDATE sessions SET expires=? WHERE token=?', (now + SESSION_SECONDS, digest))
            return True

    def logout(self, cookie):
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute('DELETE FROM sessions WHERE token=?', (_token_hash(self.token(cookie)),))
