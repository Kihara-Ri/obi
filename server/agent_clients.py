"""对外调用方清单 credentials/clients.json：每个调用方一枚令牌、若干权限（D-050）。

只保存令牌的 SHA-256。服务器按文件修改时间热加载，签发、改权限、轮换、撤销都不需要重启；
文件损坏时拒绝全部调用方（失败即关闭），不沿用旧内容。server/client_admin.py（管理命令）用同一模块读写。
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import sys
import threading

SCOPES = ('listing:read', 'trading:write', 'collection:read', 'insight:read')
PREFIX = 'obi_client_'
TOKEN_RE = re.compile(re.escape(PREFIX) + r'[A-Za-z0-9_-]{43}')
NAME_MAX = 40
# 旧的单能力令牌文件：迁移时保留原令牌，Agent 不用改配置
LEGACY = {'listing-agent.token': ('listing:read', b'obi_listing_'),
          'trading-agent.token': ('trading:write', b'obi_trading_'),
          'collection-read.token': ('collection:read', b'obi_collection_')}


def clients_path(data_dir):
    return Path(data_dir) / 'credentials' / 'clients.json'


def digest(token):
    return hashlib.sha256(token.encode() if isinstance(token, str) else token).hexdigest()


def new_token():
    return PREFIX + secrets.token_urlsafe(32)


def clean_name(name):
    name = ' '.join(str(name).split())
    if not name or len(name) > NAME_MAX:
        raise ValueError(f'调用方名称需为 1–{NAME_MAX} 字')
    return name


def clean_scopes(scopes):
    unknown = [s for s in scopes if s not in SCOPES]
    if unknown or not scopes:
        raise ValueError('权限只能是 ' + '、'.join(SCOPES) + (f'；无效：{"、".join(unknown)}' if unknown else ''))
    return [s for s in SCOPES if s in scopes]


def parse(raw):
    """校验整份清单；任何一项不合规都视为整份无效。"""
    data = json.loads(raw)
    if not isinstance(data, dict) or data.get('version') != 1 or not isinstance(data.get('clients'), list):
        raise ValueError('clients.json 格式无效')
    names, hashes = set(), set()
    for c in data['clients']:
        if not isinstance(c, dict) or not isinstance(c.get('scopes'), list):
            raise ValueError('clients.json 中有无效的调用方')
        if clean_name(c.get('name', '')) != c['name'] or clean_scopes(c['scopes']) != c['scopes']:
            raise ValueError('clients.json 中有无效的调用方')
        if not re.fullmatch(r'[0-9a-f]{64}', str(c.get('sha256', ''))):
            raise ValueError('clients.json 中有无效的令牌摘要')
        if c['name'] in names or c['sha256'] in hashes:
            raise ValueError('clients.json 中有重复的调用方或令牌')
        names.add(c['name']); hashes.add(c['sha256'])
    return data


def read(data_dir):
    try:
        return parse(clients_path(data_dir).read_text(encoding='utf-8'))
    except FileNotFoundError:
        return {'version': 1, 'clients': []}


def write(data_dir, data):
    """原子替换，权限 0600。"""
    path = clients_path(data_dir)
    path.parent.mkdir(mode=0o700, exist_ok=True)
    parse(json.dumps(data))
    tmp = path.with_name(f'.clients.{os.getpid()}.tmp')
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    os.replace(tmp, path)


def now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


_EDIT = threading.Lock()   # 网页端与同进程内的并发改动串行；命令行是独立进程，按原子替换兜底


def find(data, name):
    for c in data['clients']:
        if c['name'] == name:
            return c
    raise ValueError(f'没有名为「{name}」的调用方')


def issue(data_dir, name, scopes):
    """签发新调用方，返回只出现这一次的令牌。"""
    with _EDIT:
        data, name = read(data_dir), clean_name(name)
        if any(c['name'] == name for c in data['clients']):
            raise ValueError(f'调用方「{name}」已存在；换令牌请用轮换')
        token = new_token()
        data['clients'].append({'name': name, 'scopes': clean_scopes(scopes), 'sha256': digest(token),
                                'createdAt': now()})
        write(data_dir, data)
        return token


def rotate(data_dir, name):
    with _EDIT:
        data, token = read(data_dir), new_token()
        client = find(data, name)
        client['sha256'], client['createdAt'] = digest(token), now()
        write(data_dir, data)
        return token


def set_scopes(data_dir, name, scopes):
    with _EDIT:
        data = read(data_dir)
        client = find(data, name)
        client['scopes'] = clean_scopes(scopes)
        write(data_dir, data)
        return client['scopes']


def revoke(data_dir, name):
    with _EDIT:
        data = read(data_dir)
        find(data, name)
        data['clients'] = [c for c in data['clients'] if c['name'] != name]
        write(data_dir, data)


class ClientRegistry:
    """服务器侧的只读视图：令牌摘要 → (名称, 权限)。"""

    def __init__(self, data_dir):
        self.path = clients_path(data_dir)
        self._lock = threading.Lock()
        self._key = None
        self._clients = {}

    def _refresh(self):
        try:
            st = self.path.stat()
            key = (st.st_mtime_ns, st.st_size, st.st_ino)
        except FileNotFoundError:
            key = None
        with self._lock:
            if key == self._key:
                return self._clients
            clients = {}
            if key is not None:
                try:
                    data = parse(self.path.read_text(encoding='utf-8'))
                    clients = {c['sha256']: (c['name'], frozenset(c['scopes'])) for c in data['clients']}
                except (OSError, ValueError) as e:
                    print(f'对外调用方清单无效，已拒绝全部调用方：{e}', file=sys.stderr)
            self._key, self._clients = key, clients
            return clients

    def lookup(self, token):
        """返回 (名称, 权限)；未知令牌返回 None。"""
        return self._refresh().get(digest(token)) if token else None

    def grants(self, scope):
        return any(scope in scopes for _, scopes in self._refresh().values())
