"""官方开源 SIWC 登录：独立 PKCE + loopback listener；不读取 Codex/Pi 凭据。"""
import hashlib
import hmac
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlencode, urlsplit, parse_qs
from domain import ValidationError
from .chatgpt_credentials import Credentials, RESOURCE, token_request, token_values
from .chatgpt_identity import verify_identity
from .listing_transport import request


class ChatGPTAuth:
    def __init__(self, data):
        self.credentials = Credentials(data)
        self.lock = threading.RLock()
        self.pending = None
        self.login_error = ''
        self.processing = False

    def settings(self):
        with self.credentials.locked() as state:
            return {key: state[key] for key in ('method', 'model', 'active')}

    def status(self):
        with self.credentials.locked() as state:
            accounts = [{'id': key, 'label': (value.get('email') or 'ChatGPT') + ' · ' + value['client_id'][-8:]}
                        for key, value in state['accounts'].items()]
            connected = bool(state['accounts'].get(state['active'], {}).get('refresh_token'))
            return {**{key: state[key] for key in ('hostId', 'method', 'model', 'active')},
                    'connected': connected, 'accounts': accounts, 'loginError': self.login_error,
                    'loginPending': self.processing or bool(self.pending and self.pending['expires'] > time.time())}

    def configure(self, data):
        with self.credentials.locked() as state:
            if data.get('method') not in ('oauth', 'api'): raise ValidationError('请选择识别通道')
            active = data.get('active', state['active'])
            if active and active not in state['accounts']: raise ValidationError('账号不存在')
            model = data.get('model', state['model'])
            if not isinstance(model, str) or len(model) > 150: raise ValidationError('模型无效')
            state.update(method=data['method'], active=active, model=model)
        return self.status()

    def cancel(self):
        with self.lock:
            if self.pending: self.pending['stop'].set()
            self.pending = None

    def start(self, account=''):
        with self.lock:
            self.cancel(); self.login_error = ''
            with self.credentials.locked() as state:
                saved = state['accounts'].get(account, {})
                if account and not saved: raise ValidationError('账号不存在')
                host = state['hostId']
            owner = self
            class Callback(BaseHTTPRequestHandler):
                def log_message(self, *args): pass  # 授权码与 state 不写访问日志
                def do_GET(self):
                    if urlsplit(self.path).path != '/auth/callback':
                        self.send_error(404); return
                    try:
                        owner.finish(parse_qs(urlsplit(self.path).query))
                        message = 'ChatGPT authorization complete. Return to Obi.'
                    except ValidationError as exc:
                        owner.login_error = str(exc)
                        message = 'Authorization failed. Return to Obi and retry.'
                    raw = message.encode()
                    self.send_response(200); self.send_header('Content-Type', 'text/plain; charset=utf-8')
                    self.send_header('Cache-Control', 'no-store'); self.send_header('Content-Length', str(len(raw)))
                    self.end_headers(); self.wfile.write(raw)
            server = HTTPServer(('127.0.0.1', 0), Callback)
            server.timeout = 1
            verifier = secrets.token_urlsafe(48)
            pending = {'state': secrets.token_urlsafe(32), 'nonce': secrets.token_urlsafe(32),
                       'verifier': verifier, 'expires': time.time() + 600, 'stop': threading.Event(),
                       'redirect': f'http://127.0.0.1:{server.server_port}/auth/callback',
                       'client': saved.get('client_id', ''), 'subject': saved.get('subject', '')}
            self.pending = pending
            params = {'client_id': pending['client'] or 'dynamic_agent_client', 'ext_agent_host_id': host,
                      'response_type': 'code', 'redirect_uri': pending['redirect'],
                      'scope': 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
                      'resource': RESOURCE, 'state': pending['state'], 'nonce': pending['nonce'],
                      'code_challenge_method': 'S256',
                      'code_challenge': __import__('base64').urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()}
            if not pending['client']: params['agent_name_hint'] = 'Obi'
            # 不向前端返回含 id_token_hint 的 URL；已注册客户端仍保留绑定身份核验。
            def listen():
                try:
                    while not pending['stop'].is_set() and pending['expires'] > time.time(): server.handle_request()
                finally: server.server_close()
            threading.Thread(target=listen, daemon=True, name='listing-oauth').start()
            return {'url': 'https://auth.openai.com/api/accounts/authorize?' + urlencode(params)}

    def finish(self, query):
        with self.lock:
            pending = self.pending
            if (not pending or pending['expires'] < time.time()
                    or not hmac.compare_digest(query.get('state', [''])[0], pending['state'])):
                raise ValidationError('授权请求已过期或 state 不匹配，请重新登录')
            self.cancel()  # 一次性消费，失败需重新开始
            self.processing = True
            try:
                self._complete(pending, query)
            finally:
                self.processing = False

    def _complete(self, pending, query):
        if query.get('error'): raise ValidationError('ChatGPT 授权未完成，请重试')
        client = query.get('client_id', [pending['client']])[0]
        if not client or client == 'dynamic_agent_client' or pending['client'] and client != pending['client']:
            raise ValidationError('OpenAI 未返回匹配的注册客户端')
        code = query.get('code', [''])[0]
        if not code: raise ValidationError('缺少授权码')
        result = token_request({'grant_type': 'authorization_code', 'client_id': client, 'code': code,
                                'code_verifier': pending['verifier'], 'redirect_uri': pending['redirect']})
        keys = request('https://auth.openai.com/.well-known/jwks.json')
        identity = verify_identity(result.get('id_token'), client, pending['nonce'], keys)
        if pending['subject'] and identity['sub'] != pending['subject']:
            raise ValidationError('登录账号与原注册身份不符，请添加新账号')
        values = token_values(result)
        with self.credentials.locked() as state:
            key = hashlib.sha256((client + ':' + identity['sub']).encode()).hexdigest()[:24]
            state['accounts'][key] = {**values, 'client_id': client, 'subject': identity['sub'], 'email': identity.get('email', '')}
            state.update(active=key, method='oauth', model='')

    def access_token(self, account_id=None): return self.credentials.access_token(account_id)

    def models(self):
        result = request(RESOURCE + '/models', headers={'Authorization': 'Bearer ' + self.access_token()})
        return [{'value': item['slug'], 'label': item.get('display_name', item['slug'])}
                for item in result.get('models', []) if item.get('visibility') == 'list' and isinstance(item.get('slug'), str)]

    def disconnect(self):
        self.cancel()
        revoked = True
        with self.credentials.locked() as state:
            account = state['accounts'].get(state['active'], {})
            if account.get('refresh_token'):
                try:
                    discovery = request('https://auth.openai.com/.well-known/openid-configuration')
                    endpoint = discovery.get('revocation_endpoint', '')
                    if not endpoint.startswith('https://auth.openai.com/'): raise ValidationError('撤销地址无效')
                    request(endpoint, urlencode({'token': account['refresh_token'], 'token_type_hint': 'refresh_token',
                                                 'client_id': account['client_id']}).encode(),
                            {'Content-Type': 'application/x-www-form-urlencoded'})
                except ValidationError: revoked = False
            for key in ('access_token', 'refresh_token', 'id_token'): account.pop(key, None)
        return {'revoked': revoked}
