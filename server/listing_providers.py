"""独立保存各服务商连接、模型和强度；目录按授权身份隔离，任务快照不对外返回。"""
import copy
import os
from domain import ValidationError
from .chatgpt_credentials import RESOURCE
from .listing_capabilities import normalize_models
from .listing_claude import ClaudeProvider
from .listing_provider_config import ProviderConfig, api_endpoint, api_key, fingerprint, provider_id
from .listing_transport import request


class ListingProviders:
    def __init__(self, auth):
        self.auth = auth
        self.config = ProviderConfig(auth.credentials.path.parent.parent, auth.settings())
        self.claude = ClaudeProvider(auth.credentials.path.parent.parent)

    def identity(self, provider, state):
        if provider == 'openai':
            value = self.auth.status()
            return value['active'], value['connected']
        if provider == 'anthropic':
            value = self.claude.status()
            return value.get('accountId') or value.get('label', ''), value['connected']
        key = api_key(provider, state)
        return fingerprint(api_endpoint(provider) + ':' + key), bool(key)

    def profile(self, provider, state):
        scope, connected = self.identity(provider, state)
        name = provider + ':' + scope
        return name, state['profiles'].get(name, {}), connected

    def status(self):
        state = self.config.read()
        provider = state['provider']
        name, profile, connected = self.profile(provider, state)
        legacy, claude = self.auth.status(), self.claude.status()
        models = state['catalogues'].get(name, [])
        model = profile.get('model') or (os.getenv('LISTING_API_MODEL', '') if provider == 'api' else '')
        selected = next((row for row in models if row['value'] == model), None)
        ready = connected and bool(model) and (provider == 'api' or selected is not None and selected['vision'] is not False)
        login = claude if provider == 'anthropic' else legacy
        return {**legacy, 'provider': provider, 'method': 'api' if provider in ('api', 'deepseek') else 'oauth',
                'model': model, 'effort': profile.get('effort', ''), 'connected': connected, 'ready': bool(ready),
                'models': models, 'apiConfigured': bool(api_key('api', state) and os.getenv('LISTING_API_MODEL')),
                'apiModel': os.getenv('LISTING_API_MODEL', ''), 'loginPending': login.get('loginPending', False),
                'loginError': login.get('loginError', ''), 'loginUrl': login.get('loginUrl', ''),
                'claudeInstalled': claude['installed'], 'providers': [
                    {'id': item, 'connected': self.identity(item, state)[1]} for item in ('openai', 'deepseek', 'anthropic', 'api')]}

    def configure(self, data):
        state = self.config.read()
        provider = provider_id(data.get('provider', 'api' if data.get('method') == 'api' else
                                       'openai' if data.get('method') == 'oauth' else state['provider']))
        if 'active' in data:
            self.auth.configure({'method': 'oauth', 'active': data['active']})
        name, profile, _ = self.profile(provider, state)
        profile = copy.deepcopy(profile)
        model = data.get('model', profile.get('model', ''))
        effort = data.get('effort', '' if 'model' in data and model != profile.get('model') else profile.get('effort', ''))
        if not isinstance(model, str) or len(model) > 150 or not isinstance(effort, str):
            raise ValidationError('模型或思考强度无效')
        if model and ('model' in data or 'effort' in data):
            row = next((row for row in state['catalogues'].get(name, []) if row['value'] == model), None)
            if not row or row['vision'] is False: raise ValidationError('请从当前服务商目录选择支持图片的模型')
            if effort and effort not in row['efforts']: raise ValidationError('该模型不支持所选思考强度')
        elif effort and not model: raise ValidationError('请先选择模型')
        with self.config.locked() as current:
            current['provider'] = provider
            current['profiles'][name] = {**profile, 'model': model, 'effort': effort}
        return self.status()

    def connect(self, data):
        provider = provider_id(data.get('provider'))
        if provider != 'deepseek': raise ValidationError('该服务商请使用授权登录或服务端配置')
        key = data.get('apiKey', '')
        if not isinstance(key, str) or not 1 <= len(key) <= 2000 or any(c.isspace() for c in key):
            raise ValidationError('请输入有效的 DeepSeek API Key')
        with self.config.locked() as state:
            state['profiles'][provider] = {'apiKey': key}
            for field in ('profiles', 'catalogues'):
                for name in list(state[field]):
                    if name.startswith(provider + ':'): del state[field][name]
        return self.status()

    def models(self, provider=None):
        state = self.config.read()
        provider = provider_id(provider or state['provider'])
        name, _, connected = self.profile(provider, state)
        if not connected: raise ValidationError('请先连接所选服务商')
        if provider == 'anthropic': rows = self.claude.models(account=name.split(':', 1)[1])
        else:
            base = RESOURCE if provider == 'openai' else api_endpoint(provider)
            key = self.auth.access_token(name.split(':', 1)[1]) if provider == 'openai' else api_key(provider, state)
            result = request(base + '/models', headers={'Authorization': 'Bearer ' + key})
            rows = result.get('models' if provider == 'openai' else 'data')
        rows = normalize_models(provider, rows)
        with self.config.locked() as current:
            current['catalogues'][name] = rows
            profile = current['profiles'].get(name, {})
            selected = next((r for r in rows if r['value'] == profile.get('model') and r['vision'] is not False), None)
            if not selected: current['profiles'][name] = {'model': '', 'effort': ''}
            elif profile.get('effort') and profile['effort'] not in selected['efforts']: profile['effort'] = ''
        return rows

    def snapshot(self):
        state = self.config.read()
        provider = state['provider']
        name, profile, connected = self.profile(provider, state)
        model = profile.get('model') or (os.getenv('LISTING_API_MODEL', '') if provider == 'api' else '')
        selected = next((r for r in state['catalogues'].get(name, []) if r['value'] == model), None)
        if not connected or not model or (provider != 'api' and (not selected or selected['vision'] is False)):
            raise ValidationError('请先连接服务商、读取模型并选择支持图片的模型')
        result = {'provider': provider, 'model': model, 'effort': profile.get('effort', ''), 'account': name.split(':', 1)[1]}
        if provider in ('api', 'deepseek'): result.update(base=api_endpoint(provider), key=api_key(provider, state))
        return result

    def disconnect(self, provider):
        provider = provider_id(provider)
        if provider == 'openai': return self.auth.disconnect()
        if provider == 'anthropic': return self.claude.disconnect()
        if provider == 'api': raise ValidationError('请在服务端移除 API 密钥配置')
        with self.config.locked() as state:
            state['profiles'][provider] = {'disabled': True}
            for field in ('profiles', 'catalogues'):
                for name in list(state[field]):
                    if name.startswith(provider + ':'): del state[field][name]
        return {'revoked': True}
