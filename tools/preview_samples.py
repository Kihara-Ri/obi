#!/usr/bin/env python3
"""One entry point for the persistent, offline sample preview.

prepare --download: first acquisition; prepare: offline fresh reconstruction;
start (default): validate and run the same development instance;
backup/restore: complete JSON+image snapshot, without direct database writes.
"""
import argparse
import datetime
import fcntl
import io
import json
import os
from pathlib import Path
import shutil
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools import sample_bundle as bundle
from tools.seed_samples import check_target, open_store, seed


def default_home():
    configured = os.environ.get('OBI_DEV_HOME')
    if configured:
        return Path(configured).expanduser()
    if sys.platform == 'darwin':
        return Path.home() / 'Library/Application Support/Obi/development'
    return Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local/share')) / 'obi/development'


def backup(data_dir, output, asset_bundle=None, lock_path=bundle.LOCK):
    data_dir, output = map(bundle.guard, (data_dir, output))
    asset_bundle = Path(asset_bundle) if asset_bundle else data_dir.parent / 'bundle'
    # Archive the instance's original version before any upgrade replaces its lock.
    manifest = json.loads((asset_bundle / 'manifest.json').read_text())
    marker = json.loads((data_dir / 'sample-preview.json').read_text())
    if marker != {'sampleVersion':manifest['sampleVersion'], 'bundleDigest':bundle.digest(bundle.encoded(manifest))}:
        # A contract-only package refresh retains the public prior manifest so
        # --rebuild can still archive the old instance with its original lock.
        digest = marker.get('bundleDigest')
        if not isinstance(digest, str) or len(digest) != 64 or any(c not in '0123456789abcdef' for c in digest):
            raise ValueError('实例与原素材包不匹配；未创建混合版本归档')
        previous = asset_bundle / 'history' / (digest + '.json')
        if not previous.is_file():
            raise ValueError('实例与原素材包不匹配；未创建混合版本归档')
        manifest = json.loads(previous.read_text())
        if marker != {'sampleVersion':manifest['sampleVersion'], 'bundleDigest':bundle.digest(bundle.encoded(manifest))}:
            raise ValueError('实例与原素材包不匹配；未创建混合版本归档')
    bundle.verify_contents(asset_bundle, manifest)
    if check_target(data_dir):
        raise ValueError('只能备份固定开发样本')
    state = open_store(data_dir).backup()
    files, blobs = {}, {}
    for folder in ('covers', 'photos', 'digital-twins', 'engine-models'):
        for path in sorted((data_dir / folder).rglob('*')):
            if path.is_file():
                sha = bundle.digest(path.read_bytes())
                files[str(path.relative_to(data_dir))] = sha
                blobs[sha] = path
    for sha, asset in manifest['assets'].items():
        blobs[sha] = asset_bundle / 'assets' / asset['file']
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise ValueError('备份文件已存在')
    temporary = output.with_suffix('.partial')
    try:
        with tarfile.open(temporary, 'w:gz') as archive:
            for name, raw in [('state.json', bundle.encoded(state)), ('files.json', bundle.encoded(files)),
                              ('bundle-manifest.json', bundle.encoded(manifest)),
                              ('sample-preview.json', (data_dir / 'sample-preview.json').read_bytes())]:
                info = tarfile.TarInfo(name); info.size = len(raw)
                archive.addfile(info, io.BytesIO(raw))
            for sha, path in blobs.items():
                archive.add(path, arcname='blobs/' + sha, recursive=False)
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    return output


def restore_snapshot(source, data_dir, asset_bundle, lock_path=bundle.LOCK):
    data_dir, asset_bundle = map(bundle.guard, (data_dir, asset_bundle))
    if data_dir.exists() and any(data_dir.iterdir()):
        raise ValueError('快照恢复须使用空目录；现有开发实例未修改')
    data_dir.parent.mkdir(parents=True, exist_ok=True)
    # Validate and restore inside staging. Failed restores leave the target usable.
    with tempfile.TemporaryDirectory(prefix='.restore-', dir=data_dir.parent) as temp:
        staged, staged_bundle = Path(temp) / 'instance', Path(temp) / 'bundle'
        with tarfile.open(source, 'r:gz') as archive:
            members = archive.getmembers()
            names = [m.name for m in members]
            if len(set(names)) != len(names) or any(not m.isfile() for m in members):
                raise ValueError('快照含重复路径或非法文件类型')
            allowed = {'state.json','files.json','bundle-manifest.json','sample-preview.json'}
            if any(name not in allowed and (not name.startswith('blobs/') or len(name) != 70
                   or any(c not in '0123456789abcdef' for c in name[6:])) for name in names):
                raise ValueError('快照含非法路径')
            manifest = json.load(archive.extractfile('bundle-manifest.json'))
            if manifest != bundle.lock(lock_path):
                raise ValueError('快照版本与当前锁定素材不符')
            files = json.load(archive.extractfile('files.json'))
            state = json.load(archive.extractfile('state.json'))
            marker = archive.extractfile('sample-preview.json').read()
            (staged_bundle / 'assets').mkdir(parents=True)
            for sha, asset in manifest['assets'].items():
                raw = archive.extractfile('blobs/' + sha).read()
                if bundle.digest(raw) != sha:
                    raise ValueError('快照素材损坏')
                (staged_bundle / 'assets' / asset['file']).write_bytes(raw)
            (staged_bundle / 'manifest.json').write_bytes(bundle.encoded(manifest))
            seed(staged)
            for name, sha in files.items():
                parts = Path(name).parts
                if (not parts or parts[0] not in ('covers','photos','digital-twins','engine-models')
                        or Path(name).is_absolute() or '..' in parts):
                    raise ValueError('快照素材路径非法')
                raw = archive.extractfile('blobs/' + sha).read()
                if bundle.digest(raw) != sha:
                    raise ValueError('快照发布资源损坏')
                target = staged / name
                target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(raw)
            open_store(staged).restore_backup(state)
            (staged / 'sample-preview.json').write_bytes(marker)
        result = bundle.check(staged_bundle, staged, lock_path)
        if asset_bundle.exists():
            bundle.verify(asset_bundle, lock_path)
        else:
            asset_bundle.parent.mkdir(parents=True, exist_ok=True)
            staged_bundle.rename(asset_bundle)
        if data_dir.exists(): data_dir.rmdir()
        staged.rename(data_dir)
    return result


def prepare(home, rebuild=False, download=False):
    home = bundle.guard(home)
    assets, data = home / 'bundle', home / 'instance'
    occupied = data.exists() and any(data.iterdir())
    if rebuild and occupied:
        if check_target(data) or not (data / 'sample-preview.json').is_file():
            raise ValueError('无法识别原开发实例版本；未覆盖原目录')
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        backup(data, home / 'backups' / ('samples-' + stamp + '.tar.gz'))
    elif occupied:
        # Refuse to change a bundle underneath an existing instance without archive.
        bundle.verify(assets)
        return bundle.check(assets, data)
    # Stage the bundle too: a failed publication must not strand the old instance
    # beside a new manifest. Content-addressed originals are immutable.
    home.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.prepare-', dir=home) as temp:
        temporary = Path(temp)
        candidate = assets
        if download:
            candidate = temporary / 'bundle'
            if assets.exists():
                shutil.copytree(assets, candidate)
            bundle.download(candidate)
        else:
            bundle.verify(assets)
        staged = temporary / 'instance'
        result = bundle.restore(candidate, staged)
        previous, previous_bundle = temporary / 'previous', temporary / 'previous-bundle'
        try:
            if data.exists(): data.rename(previous)
            if download:
                if assets.exists(): assets.rename(previous_bundle)
                candidate.rename(assets)
            staged.rename(data)
        except OSError:
            if previous.exists() and not data.exists(): previous.rename(data)
            if previous_bundle.exists():
                if assets.exists(): shutil.rmtree(assets)
                previous_bundle.rename(assets)
            raise
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', nargs='?', choices=('start','prepare','check','backup','restore'), default='start')
    parser.add_argument('--home', type=Path, default=default_home())
    parser.add_argument('--port', type=int, default=63282)
    parser.add_argument('--download', action='store_true', help='仅 prepare：显式获取锁定素材')
    parser.add_argument('--rebuild', action='store_true', help='仅 prepare：完整归档后重建开发实例')
    parser.add_argument('--file', type=Path, help='backup 输出 / restore 输入')
    args = parser.parse_args()
    if (args.download or args.rebuild) and args.command != 'prepare':
        parser.error('--download / --rebuild 只用于 prepare')
    home = bundle.guard(args.home)
    try:
        lease = None
        if args.command != 'check':
            home.mkdir(parents=True, exist_ok=True)
            lease = os.open(home / 'preview.lock', os.O_CREAT | os.O_RDWR, 0o600)
            try:
                fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise ValueError('固定开发实例正在运行；先停止预览再准备、备份或恢复') from None
            os.set_inheritable(lease, True)
        if args.command == 'prepare':
            result = prepare(home, args.rebuild, args.download)
        elif args.command == 'backup':
            if not args.file: parser.error('backup 须提供 --file')
            bundle.check(home / 'bundle', home / 'instance')
            print(backup(home / 'instance', args.file)); return
        elif args.command == 'restore':
            if not args.file: parser.error('restore 须提供 --file')
            result = restore_snapshot(args.file, home / 'instance', home / 'bundle')
        else:
            result = bundle.check(home / 'bundle', home / 'instance')
        if args.command == 'start':
            print('样本就绪：21 张真实封面 / 3 个真实图集模型；离线启动', flush=True)
            os.execv(sys.executable, [sys.executable, str(ROOT / 'app.py'), '--port', str(args.port),
                                     '--data-dir', str(home / 'instance'), '--no-seed'])
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, KeyError, tarfile.TarError, EOFError) as error:
        parser.exit(1, '开发预览未就绪：' + str(error) + '\n首次准备：python3 tools/preview_samples.py prepare --download\n已有实例需重建：python3 tools/preview_samples.py prepare --download --rebuild\n')


if __name__ == '__main__':
    main()
