"""Shop-brand discovery: Pi OAuth/API-key adapter + bounded cached favicon lookup.

Only new purchase channels are queued, after successful record persistence.
Never modify the user's entered shop name based on an LLM guess.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

from domain import ValidationError

CACHE_KEY = 'shop-brand-cache-v1'
DOMAIN_RE = re.compile(r'^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$')
NAME_LIMIT = 160


def normalize(name):
    return re.sub(r'\s+', '', name or '').casefold()


def pi_binary():
    return shutil.which('pi')


def pi_environment():
    env = os.environ.copy()
    if shutil.which('node'):
        try:
            result = subprocess.run(['node', '--version'], capture_output=True, text=True, timeout=3)
            if int(result.stdout.strip().lstrip('v').split('.')[0]) >= 22:
                return env
        except (ValueError, OSError, subprocess.TimeoutExpired):
            pass
    # Pi requires Node >= 22; support local nvm installs without changing global PATH.
    candidates = sorted((Path.home() / '.nvm/versions/node').glob('v22.*/bin/node'), reverse=True)
    for path in candidates:
        if path.is_file():
            env['PATH'] = str(path.parent) + os.pathsep + env.get('PATH', '')
            break
    return env


def infer_domain(shop, *, provider=None, model=None):
    """Run the installed Pi CLI without tools, extensions, repo context or sessions.

    Authentication and token rotation are owned by Pi (~/.pi/agent/auth.json).
    No credentials pass through browser endpoints or this application's database.
    """
    binary = pi_binary()
    if not binary:
        raise RuntimeError('Pi 尚未安装；可使用 pi 安装并登录后重试')
    provider = provider or os.getenv('SHOP_PI_PROVIDER', 'openai-codex')
    model = model or os.getenv('SHOP_PI_MODEL', 'gpt-5.5')
    if not re.fullmatch(r'[a-z0-9-]{2,48}', provider) or not re.fullmatch(r'[a-zA-Z0-9_.:-]{2,90}', model):
        raise ValidationError('Pi 模型配置无效')
    prompt = ('Only identify the OFFICIAL company website of the following record/CD purchase channel. '
              'The label can be a local store, branch, private seller, test example or an ambiguous name. '
              'Never invent a domain, never map a local or ambiguous shop to an unrelated big platform. '
              'Reply with ONE compact JSON object (no markdown): '
              '{"domain":"example.com" or "","confidence":"high" or "low"}. '
              'Use high ONLY when you can confidently recognize the actual company/brand. '
              'For local stores without a trustworthy official domain, return empty domain and low. '
              'Channel: ' + json.dumps(shop, ensure_ascii=False))
    cmd = [binary, '--print', '--no-session', '--no-tools', '--no-extensions',
           '--no-skills', '--no-context-files', '--no-prompt-templates',
           '--no-themes', '--provider', provider, '--model', model,
           '--thinking', 'off', '--', prompt]
    result = subprocess.run(cmd, cwd='/tmp', env=pi_environment(), text=True,
                            capture_output=True, timeout=75, check=False)
    if result.returncode:
        raise RuntimeError('Pi 模型请求未成功（检查订阅登录、模型与网络配置）')
    raw = result.stdout.strip()
    match = re.search(r'\{[^{}]{0,1000}\}', raw)
    if not match:
        raise RuntimeError('Pi 未返回可解析的商家资料')
    data = json.loads(match.group(0))
    domain = data.get('domain', '')
    if data.get('confidence') != 'high' or not isinstance(domain, str):
        return ''
    domain = domain.strip().lower().rstrip('.')
    return domain if DOMAIN_RE.fullmatch(domain) else ''


class GoogleIconRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        host = urlsplit(newurl).hostname
        if (urlsplit(newurl).scheme != 'https' or
                host not in ('www.google.com', 'google.com') and
                not re.fullmatch(r't[0-9]\.gstatic\.com', host or '')):
            raise ValueError('图标服务发生跨域重定向')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def favicon(domain):
    """Fetch only through fixed Google Favicon service, not from model-supplied URLs."""
    url = 'https://www.google.com/s2/favicons?' + urlencode({'domain': domain, 'sz': '64'})
    req = Request(url, headers={'User-Agent': 'Diedu/2.9 personal local library'})
    with build_opener(GoogleIconRedirect()).open(req, timeout=10) as response:
        body = response.read(65537)
    if len(body) > 65536 or not body.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('图标数据不是有效的受限 PNG')
    return body


class ShopBrandService:
    def __init__(self, store, infer=infer_domain, fetch=favicon):
        self.store, self.infer, self.fetch = store, infer, fetch
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='shop-brand')
        self.lock = threading.Lock()
        self.pending = set()
        # A restart can interrupt an asynchronous model call; make stale jobs retryable.
        with self.store.connect() as db, db:
            cache = self.store.meta_get(db, CACHE_KEY) or {}
            changed = False
            for item in cache.values():
                if item.get('status') == 'pending':
                    item['status'] = 'unavailable'
                    changed = True
            if changed:
                db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)',
                           (CACHE_KEY, json.dumps(cache, ensure_ascii=False)))

    def index(self):
        with self.store.connect() as db:
            return self.store.meta_get(db, CACHE_KEY) or {}

    def _update(self, name, value):
        key = normalize(name)
        with self.store.connect() as db, db:
            db.execute('BEGIN IMMEDIATE')
            items = self.store.meta_get(db, CACHE_KEY) or {}
            items[key] = value
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)',
                       (CACHE_KEY, json.dumps(items, ensure_ascii=False)))
        return value

    def schedule(self, name, retry=False):
        name = str(name or '').strip()
        if not 2 <= len(name) <= NAME_LIMIT:
            return False
        key = normalize(name)
        with self.lock:
            existing = self.index().get(key)
            if key in self.pending or (existing and not (retry and existing['status'] in ('unavailable', 'no-icon'))):
                return False
            self.pending.add(key)
            self._update(name, {'status': 'pending', 'name': name})
        self.executor.submit(self._process, name, key)
        return True

    def _process(self, name, key):
        try:
            domain = self.infer(name)
            result = {'status': 'no-icon', 'name': name}
            if domain:
                try:
                    image = self.fetch(domain)
                    ident = hashlib.sha256(key.encode('utf-8')).hexdigest()[:32]
                    folder = self.store.path.parent / 'shop-icons'
                    folder.mkdir(parents=True, exist_ok=True)
                    path = folder / (ident + '.png')
                    temp = folder / (ident + '.tmp')
                    temp.write_bytes(image)
                    temp.chmod(0o600)
                    temp.replace(path)
                    result = {'status': 'found', 'name': name, 'domain': domain,
                              'icon': '/api/shop-brand-icon/' + ident + '.png',
                              'source': 'pi-proposed-domain'}
                except Exception:
                    result = {'status': 'no-icon', 'name': name}
            self._update(name, result)
        except Exception:
            self._update(name, {'status': 'unavailable', 'name': name})
        finally:
            with self.lock:
                self.pending.discard(key)

    def icon(self, ident):
        if not re.fullmatch(r'[0-9a-f]{32}\.png', ident):
            raise ValidationError('商家图标地址无效')
        path = self.store.path.parent / 'shop-icons' / ident
        if not path.is_file():
            raise ValidationError('商家图标不存在')
        return path.read_bytes()

    def status(self):
        return {'piInstalled': bool(pi_binary()),
                'provider': os.getenv('SHOP_PI_PROVIDER', 'openai-codex'),
                'model': os.getenv('SHOP_PI_MODEL', 'gpt-5.5'),
                'loginMethod': 'pi CLI OAuth/API Key (backend only)'}
