"""固定 OpenAI issuer 的 RS256 ID-token 校验；标准库验证 RSA PKCS#1 v1.5。"""
import base64
import hashlib
import hmac
import json
import time
from domain import ValidationError


def decode(value):
    return base64.b64decode(value + '=' * (-len(value) % 4), altchars=b'-_', validate=True)


def verify_identity(token, client, nonce, jwks):
    try:
        if not isinstance(token, str) or len(token) > 30000: raise ValueError()
        head, payload, signature = token.split('.')
        header, claims = json.loads(decode(head)), json.loads(decode(payload))
        if header.get('alg') != 'RS256': raise ValueError()
        key = next(key for key in jwks['keys'] if key.get('kid') == header.get('kid')
                   and key.get('kty') == 'RSA' and key.get('alg', 'RS256') == 'RS256'
                   and key.get('use', 'sig') == 'sig')
        n, e = int.from_bytes(decode(key['n']), 'big'), int.from_bytes(decode(key['e']), 'big')
        size = (n.bit_length() + 7) // 8
        sig = decode(signature)
        if not 256 <= size <= 1024 or e < 3 or len(sig) != size or int.from_bytes(sig, 'big') >= n:
            raise ValueError()
        digest = bytes.fromhex('3031300d060960864801650304020105000420') + hashlib.sha256((head + '.' + payload).encode()).digest()
        expected = b'\0\1' + b'\xff' * (size - len(digest) - 3) + b'\0' + digest
        actual = pow(int.from_bytes(sig, 'big'), e, n).to_bytes(size, 'big')
        if not hmac.compare_digest(expected, actual): raise ValueError()
        audiences = claims.get('aud', [])
        if isinstance(audiences, str): audiences = [audiences]
        if (claims.get('iss') != 'https://auth.openai.com' or client not in audiences
                or claims.get('nonce') != nonce or not isinstance(claims.get('sub'), str) or not claims['sub']
                or type(claims.get('exp')) not in (int, float) or claims['exp'] < time.time() - 5
                or type(claims.get('iat')) not in (int, float) or claims['iat'] > time.time() + 5
                or claims.get('nbf', 0) > time.time() + 5): raise ValueError()
        return claims
    except (ValueError, KeyError, TypeError, StopIteration, OverflowError):
        raise ValidationError('OpenAI 身份令牌校验失败，请重新登录') from None
