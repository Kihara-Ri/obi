"""MCP 入口 POST /mcp（D-051）：Streamable HTTP 传输的无状态、纯 JSON 实现，只用标准库。

鉴权沿用对外令牌（D-050）：Bearer 令牌决定能看到哪些工具和提示模板。不开 SSE 流（GET /mcp 返回 405），
不发会话 id；每个请求独立处理。工具出错（参数无效、模块关闭、冲突）以 isError 结果返回给 Agent。
"""
import json
import traceback

from domain import ConflictError, ValidationError
from . import mcp_prompts, mcp_tools
from .agent_auth import any_enabled, caller
from .version import version

VERSIONS = ('2025-11-25', '2025-06-18', '2025-03-26')
INSTRUCTIONS = (
    'Obi 是唱片收藏与二手买卖账本。工具按场景分三组：采购评估（get_purchase_profile、evaluate_candidates）、'
    '买前查重复（find_purchases）、闲鱼上架到入账（find_listing_copies、get_listing_package、record_*）。'
    '金额是人民币字符串，日期 YYYY-MM-DD。写入工具只提交已核实的事实，可原样重试；遇到冲突停下来交给用户核对。'
    'prompts 里有每个场景的完整步骤。')


class RpcError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def authorize_mcp(h, svc):
    if not any_enabled(svc):
        h.send({'error': 'MCP 未启用：请先用 server.client_admin 签发令牌'}, 404)
        return False
    scheme, _, token = h.headers.get('Authorization', '').partition(' ')
    found = caller(svc, token) if scheme.lower() == 'bearer' else None
    if not found:
        h.send({'error': '需要有效的 Obi 令牌'}, 401, headers={'WWW-Authenticate': 'Bearer'})
        return False
    h.mcp_caller = found
    return True


def initialize(params):
    asked = params.get('protocolVersion')
    return {'protocolVersion': asked if asked in VERSIONS else VERSIONS[1],
            'capabilities': {'tools': {'listChanged': False}, 'prompts': {'listChanged': False}},
            'serverInfo': {'name': 'obi', 'title': 'Obi 唱片账本', 'version': version()},
            'instructions': INSTRUCTIONS}


def tool_result(data, error=False):
    text = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    out = {'content': [{'type': 'text', 'text': text}], 'isError': error}
    if isinstance(data, dict) and not error:
        out['structuredContent'] = data
    return out


def call_tool(h, svc, scopes, params):
    from .routes import WRITE_LOCK
    t = mcp_tools.BY_NAME.get(params.get('name'))
    if not t:
        raise RpcError(-32602, f"未知工具：{params.get('name')}")
    if t['scope'] not in scopes:
        return tool_result(f"这枚令牌没有 {t['scope']} 权限，不能调用 {t['name']}", True)
    args = params.get('arguments') or {}
    if not isinstance(args, dict):
        raise RpcError(-32602, 'arguments 需为对象')
    try:
        if t['lock']:
            with WRITE_LOCK:
                call = t['run'](h, svc, args)
        else:
            call = t['run'](h, svc, args)
    except ConflictError as e:
        return tool_result(f'冲突：{e}', True)
    except (ValidationError, ValueError, TypeError, KeyError) as e:
        return tool_result(str(e) or '参数无效', True)
    except Exception:
        traceback.print_exc()
        return tool_result('Obi 处理失败，请稍后重试', True)
    if call.status != 200:
        message = call.data.get('error') if isinstance(call.data, dict) else None
        return tool_result(message or f'请求失败（{call.status}）', True)
    return tool_result(call.data)


def get_prompt(scopes, params):
    p = mcp_prompts.BY_NAME.get(params.get('name'))
    if not p or not p['scopes'] <= scopes:
        raise RpcError(-32602, f"未知提示模板：{params.get('name')}")
    try:
        return mcp_prompts.render(p, params.get('arguments'))
    except ValidationError as e:
        raise RpcError(-32602, str(e)) from None


def dispatch(h, svc, method, params):
    scopes = h.mcp_caller[1]
    if method == 'initialize':
        return initialize(params)
    if method == 'ping':
        return {}
    if method == 'tools/list':
        return {'tools': [mcp_tools.describe(t) for t in mcp_tools.visible(scopes)]}
    if method == 'tools/call':
        return call_tool(h, svc, scopes, params)
    if method == 'prompts/list':
        return {'prompts': [mcp_prompts.describe(p) for p in mcp_prompts.visible(scopes)]}
    if method == 'prompts/get':
        return get_prompt(scopes, params)
    raise RpcError(-32601, f'不支持的方法：{method}')


def api_mcp(h, svc, body):
    header = h.headers.get('MCP-Protocol-Version')
    if header and header not in VERSIONS:
        return h.send({'error': f'不支持的 MCP 协议版本：{header}'}, 400)
    method, params, rid = body.get('method'), body.get('params') or {}, body.get('id')
    if body.get('jsonrpc') != '2.0' or (method is None and rid is None):
        return h.send({'jsonrpc': '2.0', 'id': rid, 'error': {'code': -32600, 'message': '无效的 JSON-RPC 请求'}})
    if 'id' not in body or method is None:     # 通知或客户端发来的响应：无需回复
        return h.send(b'', 202)
    try:
        if not isinstance(method, str) or not isinstance(params, dict):
            raise RpcError(-32600, '无效的 JSON-RPC 请求')
        reply = {'result': dispatch(h, svc, method, params)}
    except RpcError as e:
        reply = {'error': {'code': e.code, 'message': str(e)}}
    h.send({'jsonrpc': '2.0', 'id': rid, **reply})
