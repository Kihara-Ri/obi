"""请求版本及现代 Streamable HTTP 元数据校验（D-051）。"""
import base64
import re

CURRENT_VERSION = '2026-07-28'
LEGACY_VERSIONS = ('2025-11-25', '2025-06-18', '2025-03-26')
SUPPORTED_VERSIONS = (CURRENT_VERSION, *LEGACY_VERSIONS)
VERSION_HEADER = 'MCP-Protocol-Version'
PROTOCOL_META = 'io.modelcontextprotocol/'
NAME_FIELDS = {'tools/call': 'name', 'prompts/get': 'name', 'resources/read': 'uri'}


class RpcError(Exception):
    def __init__(self, code, message, data=None):
        super().__init__(message)
        self.code, self.data = code, data

    def response(self, modern):
        error = {'code': self.code, 'message': str(self)}
        if self.data is not None:
            error['data'] = self.data
        if self.code == -32022:
            return 400, error
        if modern:
            return (404 if self.code == -32601 else 400), error
        return 200, error


def is_modern(headers, method, params):
    version = headers.get(VERSION_HEADER)
    meta = params.get('_meta') if isinstance(params, dict) else None
    return (version == CURRENT_VERSION or headers.get('Mcp-Method') is not None
            or (isinstance(meta, dict) and PROTOCOL_META + 'protocolVersion' in meta)
            or (method == 'server/discover' and version not in LEGACY_VERSIONS))


def validate_version(headers):
    requested = headers.get(VERSION_HEADER)
    if requested and requested not in SUPPORTED_VERSIONS:
        raise RpcError(-32022, '不支持的 MCP 协议版本', {'supported': list(SUPPORTED_VERSIONS), 'requested': requested})


def _header_name(value):
    if not value or not re.fullmatch(r'[\t -~]+', value):
        return None
    if value.startswith('=?base64?') and value.endswith('?='):
        try:
            return base64.b64decode(value[9:-2], validate=True).decode('utf-8')
        except ValueError:
            return None
    return value


def validate_modern(headers, method, params):
    """https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#server-validation"""
    meta = params.get('_meta')
    if not isinstance(meta, dict):
        raise RpcError(-32602, '缺少 MCP 请求元数据')
    version = meta.get(PROTOCOL_META + 'protocolVersion')
    capabilities = meta.get(PROTOCOL_META + 'clientCapabilities')
    if not isinstance(version, str) or not isinstance(capabilities, dict):
        raise RpcError(-32602, 'MCP 请求元数据缺少有效协议版本或客户端能力')
    if version != CURRENT_VERSION or headers.get(VERSION_HEADER) != version:
        raise RpcError(-32020, 'MCP-Protocol-Version 必须与请求元数据匹配')
    if headers.get('Mcp-Method') != method:
        raise RpcError(-32020, 'Mcp-Method 必须与请求方法匹配')
    field = NAME_FIELDS.get(method)
    if field:
        name = _header_name(headers.get('Mcp-Name'))
        if name is None or name != params.get(field):
            raise RpcError(-32020, 'Mcp-Name 必须与请求参数匹配')
