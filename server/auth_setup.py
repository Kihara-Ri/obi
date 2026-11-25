"""Private, one-time web enrollment for a new HTTPS instance."""
import base64
import hmac
import os
from pathlib import Path
import secrets
import tempfile
from threading import Lock
from time import monotonic
from urllib.parse import urlsplit
import warnings

from security import AlreadyConfigured, FAILURE_LIMIT

SETUP_LINK = 'obi-setup-url.txt'
SETUP_LIFETIME = 30 * 60


class SetupRejected(ValueError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


class AuthSetup:
    def __init__(self, auth, origin):
        self.auth = auth
        self.origin = origin
        self.host = urlsplit(origin).netloc
        self.path = auth.path.with_name(SETUP_LINK)
        self._token = 'obi_setup_' + secrets.token_urlsafe(32)
        self._secret = secrets.token_bytes(20)
        self._expires = monotonic() + SETUP_LIFETIME
        self._failures = 0
        self._lock = Lock()
        self._write_link()

    def _write_link(self):
        # Replace atomically with a new private file even if a previous link exists.
        fd, name = tempfile.mkstemp(dir=self.path.parent, prefix='.obi-setup-', text=True)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as link:
                link.write(f'{self.origin}/setup#token={self._token}\n')
            os.replace(name, self.path)
        finally:
            Path(name).unlink(missing_ok=True)

    def pending(self):
        return bool(self._token) and not self.auth.configured()

    def _authorized(self, token):
        if not self.pending():
            raise SetupRejected(404, '首次绑定已关闭')
        if not (
            isinstance(token, str) and token.isascii()
            and len(token) == len(self._token) and hmac.compare_digest(token, self._token)
        ):
            raise SetupRejected(403, '请从服务器私有安装链接打开此页')
        if self._expires <= monotonic():
            raise SetupRejected(410, '安装链接已失效，请重启服务获取新链接')

    def key(self, token):
        with self._lock:
            self._authorized(token)
            return base64.b32encode(self._secret).decode('ascii')

    def confirm(self, token, code):
        with self._lock:
            self._authorized(token)
            try:
                self.auth.enroll_totp(self._secret, code, first_setup=True)
            except AlreadyConfigured as error:
                raise SetupRejected(404, '首次绑定已关闭') from error
            except ValueError:
                self._failures += 1
                if self._failures == FAILURE_LIMIT:
                    self._expires = 0
                    raise SetupRejected(410, '动态码尝试次数过多，请重启服务获取新链接') from None
                raise
            self._secret = b''
            self._token = ''
            try:
                self.path.unlink(missing_ok=True)
            except OSError:
                warnings.warn('首次绑定已完成，无法删除已失效的安装链接文件', RuntimeWarning)
