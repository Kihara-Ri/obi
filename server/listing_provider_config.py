"""服务商设置/密钥与目录缓存；受限文件，不进入业务库或业务备份。"""
import copy
import hashlib
import os
from urllib.parse import urlsplit
from domain import ValidationError
from .chatgpt_credentials import Credentials

PROVIDERS = ('openai', 'deepseek', 'anthropic', 'api')


def provider_id(value):
    if value not in PROVIDERS: raise ValidationError('请选择支持的模型服务商')
    return value


def api_endpoint(provider):
    name, default = ('DEEPSEEK_API_BASE', 'https://api.deepseek.com') if provider == 'deepseek' else ('LISTING_API_BASE', 'https://api.openai.com/v1')
    base = os.getenv(name, default).rstrip('/')
    parsed = urlsplit(base)
    if (parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in ('127.0.0.1', 'localhost'))
            or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment):
        raise ValidationError('模型 API 地址无效')
    return base


class ProviderConfig(Credentials):
    def __init__(self, data, legacy):
        super().__init__(data, 'listing-providers')
        with self.locked() as state:
            state.setdefault('provider', 'api' if legacy.get('method') == 'api' else 'openai')
            state.setdefault('profiles', {})
            state.setdefault('catalogues', {})

    def read(self):
        with self.locked() as state: return copy.deepcopy(state)


def api_key(provider, state):
    if state['profiles'].get(provider, {}).get('disabled'): return ''
    return (state['profiles'].get(provider, {}).get('apiKey') or
            os.getenv('DEEPSEEK_API_KEY' if provider == 'deepseek' else 'LISTING_API_KEY', ''))


def fingerprint(value): return hashlib.sha256(value.encode()).hexdigest()[:24]
