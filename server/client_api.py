"""网页端管理对外调用方令牌（D-052）：设置 · 高级 · MCP 服务。

与命令行 server.client_admin 读写同一份 credentials/clients.json（agent_clients 的同一组函数）。
只在服务器版、且已绑定动态码时可用（本机模式没有调用方清单；无登录配置时这里拒绝签发）。
令牌只在签发和轮换的响应里出现一次；列表只返回名称、权限和签发时间。
"""
from pathlib import Path

from domain import ValidationError
from . import agent_clients as ac
from .agent_auth import LEGACY_FIELD


def _root(svc):
    registry = getattr(svc, 'agent_clients', None)
    if not registry:
        return None, '本机模式不提供 MCP 服务，请使用服务器版'
    if not svc.auth or not svc.auth.configured():
        return None, '先在服务器绑定 Google Authenticator，才能签发令牌'
    return Path(registry.path).parents[1], None


def _root_or_fail(svc):
    root, reason = _root(svc)
    if not root:
        raise ValidationError(reason)
    return root


def _listing(svc, root):
    clients = [{k: c.get(k) for k in ('name', 'scopes', 'createdAt')} for c in ac.read(root)['clients']]
    legacy = [scope for scope, field in LEGACY_FIELD.items() if getattr(svc, field, None) is not None]
    return {'available': True, 'path': '/mcp', 'scopes': list(ac.SCOPES), 'clients': clients, 'legacy': legacy}


def _name(body):
    name = body.get('name')
    if not isinstance(name, str):
        raise ValidationError('缺少调用方名称')
    return name


def _scopes(body):
    scopes = body.get('scopes')
    if not isinstance(scopes, list) or not all(isinstance(s, str) for s in scopes):
        raise ValidationError('权限需为列表')
    return scopes


def api_clients(h, svc):
    root, reason = _root(svc)
    h.send(_listing(svc, root) if root else {'available': False, 'reason': reason})


def api_client_issue(h, svc, body):
    root = _root_or_fail(svc)
    token = ac.issue(root, _name(body), _scopes(body))
    h.send({'token': token, 'name': ac.clean_name(body['name']), **_listing(svc, root)})


def api_client_rotate(h, svc, body):
    root = _root_or_fail(svc)
    token = ac.rotate(root, _name(body))
    h.send({'token': token, 'name': body['name'], **_listing(svc, root)})


def api_client_scopes(h, svc, body):
    root = _root_or_fail(svc)
    ac.set_scopes(root, _name(body), _scopes(body))
    h.send(_listing(svc, root))


def api_client_revoke(h, svc, body):
    root = _root_or_fail(svc)
    ac.revoke(root, _name(body))
    h.send(_listing(svc, root))
