"""MCP 资料包的限时下载链接（D-051）：Agent 拿到链接后不带令牌也能下载这一份 ZIP。

链接绑定副本和照片版本、照片顺序及到期时间（10 分钟）。密钥只在进程内存，重启即失效。
副本或照片在此期间变了，下载按原资料包规则返回 409，不会给出过期的图。
"""
import base64
import hashlib
import hmac
import json
import secrets
import time

from domain import ValidationError

TTL = 600
PATH = '/api/mcp/package'
_KEY = secrets.token_bytes(32)


def _b64(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()


def _unb64(text):
    return base64.urlsafe_b64decode(text + '=' * (-len(text) % 4))


def sign(rid, revision, order, photo_revision, now=None):
    expires = int(now if now is not None else time.time()) + TTL
    body = _b64(json.dumps([rid, revision, order, photo_revision, expires], separators=(',', ':')).encode())
    mac = _b64(hmac.new(_KEY, body.encode(), hashlib.sha256).digest())
    return f'{body}.{mac}', expires


def verify(token, now=None):
    """返回签名绑定的副本与照片版本；签名不符或已过期时拒绝下载。"""
    body, _, mac = str(token or '').partition('.')
    good = _b64(hmac.new(_KEY, body.encode(), hashlib.sha256).digest())
    if not body or not hmac.compare_digest(mac, good):
        raise ValidationError('下载链接无效')
    rid, revision, order, photo_revision, expires = json.loads(_unb64(body))
    if expires < (now if now is not None else time.time()):
        raise ValidationError('下载链接已过期，请重新调用 get_listing_package')
    return rid, revision, order, photo_revision


def base_url(h, svc):
    return svc.public_origin or f"http://{h.headers.get('Host', '127.0.0.1')}"


def link(h, svc, manifest):
    token, expires = sign(manifest['id'], manifest['revision'], manifest['photoOrder'], manifest['photoRevision'])
    stamp = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(expires))
    return {'url': f'{base_url(h, svc)}{PATH}?t={token}', 'expiresAt': stamp, 'format': 'zip'}


def open_access(h, svc):
    """签名本身就是凭据：鉴权放到处理函数里，失败统一返回 403。"""
    return True


def api_mcp_package(h, svc):
    from .listing_agent import _package
    from .routes import WRITE_LOCK, query
    try:
        rid, revision, order, photo_revision = verify(query(h).get('t'))
    except (ValidationError, ValueError, TypeError) as error:
        return h.send({'error': str(error) if isinstance(error, ValidationError) else '下载链接无效'}, 403)
    params = {'id': rid, 'photoRevision': str(photo_revision)}
    params.update({'order': ','.join(map(str, order))} if order else {'photos': '0'})
    with WRITE_LOCK:
        package = _package(svc.store, params, expected_revision=revision)
    h.send(package, mime='application/zip', filename='obi-listing-package.zip')
