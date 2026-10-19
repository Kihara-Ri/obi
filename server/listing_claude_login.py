"""官方 Claude CLI 的独立 OAuth 登录进程；仅提取授权 URL，不读取凭据文件。"""
import re
import subprocess
import threading
import time
from urllib.parse import urlsplit
from domain import ValidationError


class ClaudeLogin:
    def __init__(self, owner):
        self.owner = owner
        self.lock = threading.RLock()
        self.process = None
        self.url = ''
        self.error = ''
        self.pending = False
        self.ready = threading.Event()
        self.generation = 0

    def status(self):
        with self.lock: return {'loginPending': self.pending, 'loginError': self.error, 'loginUrl': self.url if self.pending else ''}

    def cancel(self):
        with self.lock:
            self.generation += 1
            if self.process and self.process.poll() is None:
                try: self.process.terminate()
                except ProcessLookupError: pass
                try: self.process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    try: self.process.kill()
                    except ProcessLookupError: pass
                    try: self.process.wait(timeout=2)
                    except subprocess.TimeoutExpired:
                        raise ValidationError('Claude 登录进程尚未退出，请稍后重试') from None
            self.process = None; self.pending = False; self.url = ''

    def start(self):
        with self.owner.session(allow_login=True): return self._start()

    def _start(self):
        with self.lock:
            if self.pending: raise ValidationError('Claude 正在登录，请先完成当前授权')
            self.cancel(); self.error = ''; self.ready.clear()
            env = self.owner.environment()
            # CLI 打印授权地址，由当前浏览器打开；不在服务器上弹出浏览器。
            env['BROWSER'] = 'true'
            try:
                process = subprocess.Popen([self.owner.binary(), 'auth', 'login', '--claudeai'],
                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    cwd=self.owner.directory, env=env, text=True, bufsize=1, umask=0o077)
            except OSError: raise ValidationError('Claude 登录进程无法启动') from None
            self.process = process; self.pending = True
            generation = self.generation
        def read():
            try:
                for line in process.stdout:
                    clean = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', line)
                    for url in re.findall(r'https://[^\s<>\x1b]+', clean):
                        if urlsplit(url).hostname in ('claude.ai', 'platform.claude.com', 'console.anthropic.com'):
                            with self.lock:
                                if generation == self.generation: self.url = url; self.ready.set()
                code = process.wait()
                with self.lock:
                    if generation == self.generation:
                        self.pending = False; self.url = ''; self.owner.cached = None
                        if code: self.error = 'Claude 授权未完成，请重新登录'
                        self.ready.set()
            finally:
                for pipe in (process.stdout, process.stdin):
                    if pipe: pipe.close()
        threading.Thread(target=read, name='listing-claude-login', daemon=True).start()
        def expire():
            time.sleep(600)
            with self.owner.operation:
                with self.lock:
                    if generation == self.generation and self.pending:
                        self.cancel(); self.error = 'Claude 授权已超时，请重新登录'
        threading.Thread(target=expire, daemon=True).start()
        self.ready.wait(8)
        result = self.status()
        if result['loginError']: raise ValidationError(result['loginError'])
        return {'url': result['loginUrl'], 'pending': result['loginPending']}

    def submit(self, code):
        if not isinstance(code, str) or not 1 <= len(code.strip()) <= 3000 or '\n' in code or '\r' in code:
            raise ValidationError('授权码格式无效')
        with self.lock:
            if not self.pending or not self.process or self.process.poll() is not None:
                raise ValidationError('Claude 登录已结束，请重新开始')
            try:
                self.process.stdin.write(code.strip() + '\n'); self.process.stdin.flush()
            except (OSError, ValueError): raise ValidationError('Claude 登录已结束，请重新开始') from None
        return {'pending': True}
