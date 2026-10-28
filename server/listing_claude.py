"""通过官方 Claude Code print/SDK 协议调用；授权由 CLI 管理，不抽取其令牌。"""
import json
import os
import shutil
import subprocess
import time
import threading
from contextlib import contextmanager
from domain import ValidationError
from .listing_claude_login import ClaudeLogin


class ClaudeProvider:
    def __init__(self, data):
        self.directory = data / 'credentials' / 'listing-anthropic'
        self.operation = threading.RLock()
        self.login = ClaudeLogin(self)
        self.cached = None
        self.checked_at = 0

    @contextmanager
    def session(self, account=None, allow_login=False):
        if not self.operation.acquire(blocking=False): raise ValidationError('Claude 正在处理请求，请稍后再改授权')
        try:
            if not allow_login and self.login.status()['loginPending']:
                raise ValidationError('Claude 正在登录，请完成授权后重试')
            if account is not None:
                status = self.status(refresh=True)
                if not status['connected'] or (status.get('accountId') or status.get('label')) != account:
                    raise ValidationError('Claude 授权身份已变更，请重新读取模型并分析')
            yield
        finally: self.operation.release()

    def environment(self):
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.directory.chmod(0o700)
        env = {key: value for key, value in os.environ.items() if not key.startswith(('ANTHROPIC', 'CLAUDE'))}
        env.update(CLAUDE_CONFIG_DIR=str(self.directory), CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC='1', CLAUDE_CODE_SAFE_MODE='1')
        return env

    def binary(self):
        binary = os.getenv('LISTING_CLAUDE_BIN') or shutil.which('claude')
        if not binary: raise ValidationError('服务端尚未安装官方 Claude Code，请安装后重试')
        return binary

    def command(self):
        return [self.binary(), '--safe-mode', '--restricted', '-p', '--input-format', 'stream-json', '--output-format', 'stream-json',
                '--verbose', '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
                '--setting-sources', '', '--disable-slash-commands', '--no-session-persistence',
                '--settings', '{"disableAllHooks":true}']

    def run(self, arguments, input=None, timeout=180):
        try:
            result = subprocess.run(arguments, input=input, env=self.environment(), cwd=self.directory,
                                    text=True, capture_output=True, timeout=timeout, umask=0o077)
        except (OSError, subprocess.TimeoutExpired): raise ValidationError('Claude CLI 无法启动或请求超时') from None
        if result.returncode or len(result.stdout) > 2 * 1024 * 1024:
            raise ValidationError('Claude 请求未成功，请检查该独立账号授权、额度与模型')
        return result.stdout

    def status(self, refresh=False):
        installed = bool(os.getenv('LISTING_CLAUDE_BIN') or shutil.which('claude'))
        if not installed: return {'installed': False, 'connected': False, **self.login.status()}
        if self.cached is None or refresh or time.monotonic() - self.checked_at > 5:
            try:
                raw = self.run([self.binary(), 'auth', 'status', '--json'], timeout=10)
                value = json.loads(raw)
                method = value.get('authMethod', '')
                self.cached = {'connected': bool(value.get('loggedIn') and method in ('claude.ai', 'oauth_token')),
                               'label': value.get('email') or value.get('subscriptionType') or 'Claude',
                               'accountId': value.get('accountId', '')}
            except (ValidationError, ValueError): self.cached = {'connected': False, 'label': 'Claude', 'accountId': ''}
            self.checked_at = time.monotonic()
        return {'installed': True, **self.cached, **self.login.status()}

    def models(self, account=None):
        with self.session(account): return self._models()

    def _models(self):
        message = {'type': 'control_request', 'request_id': 'listing-models', 'request': {'subtype': 'initialize'}}
        raw = self.run(self.command(), input=json.dumps(message) + '\n', timeout=30)
        for line in raw.splitlines():
            try: value = json.loads(line)
            except ValueError: continue
            if value.get('type') == 'control_response':
                models = value.get('response', {}).get('response', {}).get('models')
                if isinstance(models, list): return models
        raise ValidationError('Claude CLI 未返回模型目录，请更新官方 CLI 后重试')

    def analyze(self, prompt, record, images, model, effort, account=None):
        with self.session(account): return self._analyze(prompt, record, images, model, effort)

    def _analyze(self, prompt, record, images, model, effort):
        from .listing_model import image_content
        return self._complete(prompt, image_content(record, images), model, effort)

    def complete(self, prompt, content, model, effort, account=None):
        with self.session(account): return self._complete(prompt, content, model, effort)

    def _complete(self, prompt, content, model, effort):
        converted = []
        for part in content:
            if part['type'] == 'text': converted.append(part)
            else:
                header, data = part['image_url']['url'].split(',', 1)
                converted.append({'type': 'image', 'source': {'type': 'base64',
                    'media_type': header.removeprefix('data:').split(';')[0], 'data': data}})
        content = converted
        args = self.command() + ['--system-prompt', prompt, '--model', model]
        if effort: args += ['--effort', effort]
        raw = self.run(args, input=json.dumps({'type': 'user', 'message': {'role': 'user', 'content': content}}) + '\n')
        for line in raw.splitlines():
            try: value = json.loads(line)
            except ValueError: continue
            if value.get('type') == 'result' and not value.get('is_error') and value.get('subtype', 'success') == 'success':
                if isinstance(value.get('result'), str): return value['result']
        raise ValidationError('Claude 未完成有效照片分析，请检查授权、额度与模型后重试')

    def disconnect(self):
        with self.session(allow_login=True):
            self.login.cancel()
            self.run([self.binary(), 'auth', 'logout'], timeout=20)
            self.cached = None
            return {'revoked': True}
