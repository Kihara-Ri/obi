"""权限受限的 OAuth 凭据：不进账本/备份；进程锁串行旋转 refresh token。"""
import fcntl
import json
import os
import time
import uuid
from contextlib import contextmanager
from urllib.parse import urlencode
from domain import ValidationError
from .listing_transport import request

RESOURCE = 'https://api.openai.com/v1'
TOKEN_URL = 'https://auth.openai.com/api/accounts/oauth/token'


def token_request(fields):
    return request(TOKEN_URL, urlencode({**fields, 'resource': RESOURCE}).encode(),
                   {'Content-Type': 'application/x-www-form-urlencoded'})


def token_values(result):
    if (not isinstance(result.get('access_token'), str) or not result['access_token']
            or not isinstance(result.get('refresh_token'), str) or not result['refresh_token']
            or result.get('token_type', '').lower() != 'bearer'
            or type(result.get('expires_in')) not in (int, float) or not 0 < result['expires_in'] <= 86400):
        raise ValidationError('OpenAI 未返回完整授权，请重新登录')
    scopes = result.get('scope', '').split()
    if 'chatgpt.tokens.use.direct' not in scopes: raise ValidationError('尚未授权使用 ChatGPT 订阅额度，请重新登录授权')
    return {'access_token': result['access_token'], 'refresh_token': result['refresh_token'],
            'id_token': result.get('id_token', ''), 'scopes': scopes,
            'expires_at': time.time() + result['expires_in']}


class Credentials:
    def __init__(self, data, name='listing-chatgpt'):
        self.path = data / 'credentials' / (name + '.json')

    @contextmanager
    def locked(self):
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path.parent.chmod(0o700)
        with self.path.with_suffix('.lock').open('a') as lock:
            os.chmod(lock.name, 0o600)
            fcntl.flock(lock, fcntl.LOCK_EX)
            try:
                if self.path.exists():
                    try: state = json.loads(self.path.read_text())
                    except (ValueError, OSError): raise ValidationError('ChatGPT 授权文件损坏，请重新配置') from None
                else: state = {'hostId': 'urn:uuid:' + str(uuid.uuid4()), 'accounts': {}, 'active': '', 'method': 'oauth', 'model': ''}
                before = json.dumps(state, ensure_ascii=False)
                yield state
                if not self.path.exists() or json.dumps(state, ensure_ascii=False) != before:
                    temporary = self.path.with_suffix('.tmp')
                    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
                    with os.fdopen(fd, 'w') as output:
                        json.dump(state, output, ensure_ascii=False)
                        output.flush(); os.fsync(output.fileno())
                    temporary.replace(self.path)
                self.path.chmod(0o600)
            finally: fcntl.flock(lock, fcntl.LOCK_UN)

    def access_token(self, account_id=None):
        with self.locked() as state:
            account = state['accounts'].get(state['active'] if account_id is None else account_id)
            if not account or not account.get('refresh_token'): raise ValidationError('请先使用 ChatGPT 登录')
            if account['expires_at'] < time.time() + 60:
                result = token_request({'grant_type': 'refresh_token', 'client_id': account['client_id'],
                                        'refresh_token': account['refresh_token']})
                values = token_values(result)
                if not values['id_token']: values['id_token'] = account.get('id_token', '')
                account.update(values)
            return account['access_token']
