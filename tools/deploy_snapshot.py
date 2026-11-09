"""Build/deploy a detached source snapshot; never build from the live working tree."""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def run(root, snapshot, flags):
    root = Path(root).resolve()
    with tempfile.TemporaryDirectory(prefix='obi-deploy-') as temp:
        checkout = Path(temp) / 'source'
        subprocess.run(['git', '-C', str(root), 'worktree', 'add', '--detach', str(checkout), snapshot], check=True)
        try:
            env = dict(os.environ)
            # Credentials stay outside the checkout; never copy the user's data directory.
            env.setdefault('SHIP_LOCAL_CONFIG', str(root / 'data/deploy.local.toml'))
            subprocess.run(['npm', '--prefix', 'web', 'ci'], cwd=checkout, env=env, check=True)
            # Backend tests serve generated assets, which a fresh checkout does not contain.
            subprocess.run(['npm', '--prefix', 'web', 'run', 'build'], cwd=checkout, env=env, check=True)
            result = subprocess.run([sys.executable, str(checkout / '.ai-kit/ship/ship.py'),
                                     '--root', str(checkout), 'deploy', *flags], cwd=checkout, env=env)
            package = checkout / 'dist/album-ledger.tar.gz'
            if package.exists():
                destination = root / 'dist/deploys' / snapshot
                destination.mkdir(parents=True, exist_ok=True)
                for path in package.parent.glob('album-ledger.tar.gz*'):
                    shutil.copy2(path, destination / path.name)
                with package.open('rb') as handle:
                    digest = hashlib.file_digest(handle, 'sha256').hexdigest()
                (destination / 'source.json').write_text(json.dumps({'commit': snapshot,
                    'shipExitCode': result.returncode,
                    'packageSha256': digest}, indent=2) + '\n')
            return result.returncode
        finally:
            subprocess.run(['git', '-C', str(root), 'worktree', 'remove', '--force', str(checkout)], check=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root'); parser.add_argument('snapshot')
    args, flags = parser.parse_known_args()
    raise SystemExit(run(args.root, args.snapshot, flags))
