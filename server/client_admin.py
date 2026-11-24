"""对外调用方令牌管理（D-050）：签发、列出、改权限、轮换、撤销、迁移旧令牌文件。

在仓库根目录、Obi 服务用户下执行；随服务器代码进入 Docker 镜像（tools/ 不进镜像）：
docker compose exec app python3 -m server.client_admin …（镜像已设 DATA_DIR=/data）。
改动立即生效，服务器无需重启。令牌只在 add / rotate 时打印一次，清单里只存 SHA-256。

    python3 -m server.client_admin --data-dir /data add 采购Agent --scope insight:read
    python3 -m server.client_admin --data-dir /data list
    python3 -m server.client_admin --data-dir /data scopes 上架Agent listing:read trading:write
    python3 -m server.client_admin --data-dir /data rotate 订单监听
    python3 -m server.client_admin --data-dir /data revoke 订单监听
    python3 -m server.client_admin --data-dir /data import-legacy
"""
import argparse
import os
from pathlib import Path
import re

from . import agent_clients as ac


def show_token(name, token):
    print(f'调用方「{name}」的令牌（只显示这一次，请存入 Agent 的密钥配置）：')
    print(token)


def cmd_add(root, args):
    show_token(ac.clean_name(args.name), ac.issue(root, args.name, args.scope))


def cmd_list(root, args):
    data = ac.read(root)
    if not data['clients']:
        print('还没有调用方')
    for c in data['clients']:
        print(f"{c['name']}\t{' '.join(c['scopes'])}\t{c.get('createdAt', '')}")
    legacy = [f for f in ac.LEGACY if (Path(root) / 'credentials' / f).exists()]
    if legacy:
        print('\n旧令牌文件（重启后生效，可用 import-legacy 迁移）：' + '、'.join(legacy))


def cmd_scopes(root, args):
    print(f'「{args.name}」的权限：' + ' '.join(ac.set_scopes(root, args.name, args.scopes)))


def cmd_rotate(root, args):
    show_token(args.name, ac.rotate(root, args.name))


def cmd_revoke(root, args):
    ac.revoke(root, args.name)
    print(f'已撤销「{args.name}」，立即生效')


def _import_legacy(root):
    data = ac.read(root)
    hashes = {c['sha256'] for c in data['clients']}
    moved = []
    for filename, (scope, prefix) in ac.LEGACY.items():
        path = Path(root) / 'credentials' / filename
        if not path.exists():
            continue
        token = path.read_bytes().strip()
        if not re.fullmatch(re.escape(prefix) + rb'[A-Za-z0-9_-]{43}', token):
            raise SystemExit(f'{filename} 格式无效，未迁移任何文件')
        if ac.digest(token) in hashes:
            continue
        name = ac.clean_name(f'旧令牌 {filename.removesuffix(".token")}')
        if any(c['name'] == name for c in data['clients']):
            raise SystemExit(f'调用方「{name}」已存在，未迁移任何文件')
        data['clients'].append({'name': name, 'scopes': [scope], 'sha256': ac.digest(token), 'createdAt': ac.now()})
        moved.append(filename)
    if moved:
        ac.write(root, data)
    return moved


def cmd_import_legacy(root, args):
    with ac.edit_lock(root):
        moved = _import_legacy(root)
    if not moved:
        print('没有需要迁移的旧令牌文件')
        return
    print('已迁移：' + '、'.join(moved) + '。令牌不变，Agent 无需改配置。')
    print('确认可用后删除这些旧文件并重启 Obi。')


def main(argv=None):
    p = argparse.ArgumentParser(description='Obi 对外调用方令牌')
    p.add_argument('--data-dir', default=os.environ.get('DATA_DIR') or os.environ.get('OBI_DATA_DIR'),
                   help='数据目录（Docker 内为 /data）；默认读取 DATA_DIR 或 OBI_DATA_DIR')
    sub = p.add_subparsers(dest='cmd', required=True)
    a = sub.add_parser('add'); a.add_argument('name'); a.add_argument('--scope', action='append', required=True,
                                                                     choices=ac.SCOPES)
    sub.add_parser('list')
    s = sub.add_parser('scopes'); s.add_argument('name'); s.add_argument('scopes', nargs='+', choices=ac.SCOPES)
    sub.add_parser('rotate').add_argument('name')
    sub.add_parser('revoke').add_argument('name')
    sub.add_parser('import-legacy')
    args = p.parse_args(argv)
    if not args.data_dir:
        p.error('请用 --data-dir 指定数据目录')
    os.umask(0o077)
    try:
        globals()['cmd_' + args.cmd.replace('-', '_')](Path(args.data_dir), args)
    except ValueError as e:
        raise SystemExit(str(e))


if __name__ == '__main__':
    main()
