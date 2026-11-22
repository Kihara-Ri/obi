"""独立 Agent 能力令牌的文件格式及鉴权。"""
import hashlib
import hmac
import re

from domain import ValidationError


def load_secret(data_dir, filename, prefix, label):
    try:
        token = (data_dir / 'credentials' / filename).read_bytes().strip()
    except FileNotFoundError:
        return None
    if not re.fullmatch(re.escape(prefix) + rb'[A-Za-z0-9_-]{43}', token):
        raise ValidationError(f'{label} 令牌格式无效，请按 Agent 上架接口说明生成')
    return hashlib.sha256(token).digest()


def authorize_agent(h, expected, label):
    if expected is None:
        h.send({'error': f'{label} 接口未启用'}, 404)
        return False
    scheme, _, token = h.headers.get('Authorization', '').partition(' ')
    digest = hashlib.sha256(token.encode()).digest()
    if scheme.lower() != 'bearer' or not hmac.compare_digest(digest, expected):
        h.send({'error': f'需要有效的{label}令牌'}, 401, headers={'WWW-Authenticate': 'Bearer'})
        return False
    return True
