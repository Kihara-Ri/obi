"""对外令牌鉴权：调用方清单（按权限，D-050）与旧的单能力令牌文件。"""
import hashlib
import hmac
import re

from domain import ValidationError

# 每项权限对应 Services 上的旧令牌摘要字段（文件方式只在启动时读取）
LEGACY_FIELD = {'listing:read': 'listing_agent_secret', 'trading:write': 'trading_agent_secret',
                'collection:read': 'collection_read_secret'}


def load_secret(data_dir, filename, prefix, label):
    try:
        token = (data_dir / 'credentials' / filename).read_bytes().strip()
    except FileNotFoundError:
        return None
    if not re.fullmatch(re.escape(prefix) + rb'[A-Za-z0-9_-]{43}', token):
        raise ValidationError(f'{label} 令牌格式无效，请按接口文档生成')
    return hashlib.sha256(token).digest()


def authorize_scope(h, svc, scope, label):
    """404 未开通 → 401 令牌无效 → 403 调用方缺少此权限。旧令牌不匹配时仍是 401，与原行为一致。"""
    legacy = getattr(svc, LEGACY_FIELD[scope], None) if scope in LEGACY_FIELD else None
    registry = getattr(svc, 'agent_clients', None)
    if legacy is None and not (registry and registry.grants(scope)):
        h.send({'error': f'{label} 接口未启用'}, 404)
        return False
    scheme, _, token = h.headers.get('Authorization', '').partition(' ')
    if scheme.lower() == 'bearer' and token:
        if legacy is not None and hmac.compare_digest(hashlib.sha256(token.encode()).digest(), legacy):
            return True
        client = registry.lookup(token) if registry else None
        if client:
            if scope in client[1]:
                return True
            h.send({'error': f'调用方「{client[0]}」没有 {scope} 权限'}, 403)
            return False
    h.send({'error': f'需要有效的{label}令牌'}, 401, headers={'WWW-Authenticate': 'Bearer'})
    return False


def scope_guard(scope, label):
    def authorize(h, svc):
        return authorize_scope(h, svc, scope, label)
    authorize.__name__ = 'authorize_' + scope.replace(':', '_')
    return authorize
