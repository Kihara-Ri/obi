"""服务商设置/密钥与目录缓存；受限文件，不进入业务库或业务备份。"""
import copy
import hashlib
import os
from urllib.parse import urlsplit
from domain import ValidationError
from .chatgpt_credentials import Credentials

PROVIDERS = ('openai', 'deepseek', 'anthropic', 'opencode', 'api')
OPENCODE_LANES = ('go', 'zen')
OPENCODE_BASE = {'go': 'https://opencode.ai/inference/go', 'zen': 'https://opencode.ai/inference'}
OPENCODE_UA = 'Obi-Album-Ledger'
OPENCODE_FORBIDDEN = '该模型可能仅限 OpenCode 客户端使用，或工作区未授权此模型'


def provider_id(value):
    if value not in PROVIDERS: raise ValidationError('请选择支持的模型服务商')
    return value


def https_base(value):
    parsed = urlsplit(value)
    if (parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in ('127.0.0.1', 'localhost'))
            or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment):
        raise ValidationError('模型 API 地址无效')
    return value.rstrip('/')


def opencode_lane(state):
    lane = (state or {}).get('opencodeLane', 'go')
    if lane not in OPENCODE_LANES: raise ValidationError('请选择 OpenCode 的计费通道')
    return lane


def api_endpoint(provider, state=None):
    if provider == 'opencode':
        lane = opencode_lane(state)
        relay = os.getenv('OPENCODE_RELAY_BASE', '').rstrip('/')
        if relay:   # 安卓本机模式：原生回环中继补 CORS 与 User-Agent（D-030）
            return https_base(relay + ('/inference/go' if lane == 'go' else '/inference'))
        return https_base(os.getenv('OPENCODE_API_BASE') or OPENCODE_BASE[lane])
    name, default = ('DEEPSEEK_API_BASE', 'https://api.deepseek.com') if provider == 'deepseek' else ('LISTING_API_BASE', 'https://api.openai.com/v1')
    return https_base(os.getenv(name, default))


def opencode_headers(key, session=''):
    headers = {'Authorization': 'Bearer ' + key, 'User-Agent': OPENCODE_UA}
    if session: headers['x-opencode-session'] = session
    return headers


class ProviderConfig(Credentials):
    def __init__(self, data, legacy):
        super().__init__(data, 'listing-providers')
        with self.locked() as state:
            state.setdefault('provider', 'api' if legacy.get('method') == 'api' else 'openai')
            state.setdefault('profiles', {})
            state.setdefault('catalogues', {})
            state.setdefault('tests', {})
            state.setdefault('opencodeLane', 'go')

    def read(self):
        with self.locked() as state: return copy.deepcopy(state)


def api_key(provider, state):
    if state['profiles'].get(provider, {}).get('disabled'): return ''
    if provider == 'opencode':
        return (state['profiles'].get(provider, {}).get('apiKey') or os.getenv('OPENCODE_API_KEY', ''))
    return (state['profiles'].get(provider, {}).get('apiKey') or
            os.getenv('DEEPSEEK_API_KEY' if provider == 'deepseek' else 'LISTING_API_KEY', ''))


def fingerprint(value): return hashlib.sha256(value.encode()).hexdigest()[:24]
