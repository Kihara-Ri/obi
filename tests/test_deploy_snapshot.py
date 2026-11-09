"""A frozen Git tree stays the build input when the original checkout changes."""
import json
import hashlib
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.deploy_snapshot import run


class DeploySnapshotTests(unittest.TestCase):
    def test_build_uses_snapshot_and_cleans_up_even_on_ship_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            real_run = subprocess.run
            def git(*args):
                return real_run(['git', '-C', str(root), *args], check=True,
                                capture_output=True, text=True).stdout.strip()
            git('init', '-q')
            (root / 'input.txt').write_text('frozen')
            git('add', 'input.txt')
            git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'fixture')
            snapshot = git('rev-parse', 'HEAD')
            (root / 'input.txt').write_text('concurrent edit')
            calls = []
            def command(argv, **kwargs):
                if argv[0] == 'git': return real_run(argv, **kwargs)
                checkout = Path(kwargs['cwd'])
                calls.append(argv)
                self.assertNotEqual(checkout, root)
                self.assertEqual((checkout / 'input.txt').read_text(), 'frozen')
                self.assertFalse((checkout / 'data').exists())
                self.assertEqual(kwargs['env']['SHIP_LOCAL_CONFIG'], str(root / 'data/deploy.local.toml'))
                if argv[0] != 'npm':
                    (checkout / 'dist').mkdir()
                    (checkout / 'dist/album-ledger.tar.gz').write_bytes(b'package fixture')
                    return subprocess.CompletedProcess(argv, 3)
                return subprocess.CompletedProcess(argv, 0)
            with patch('tools.deploy_snapshot.subprocess.run', side_effect=command), patch.dict('os.environ', {}, clear=True):
                self.assertEqual(run(root, snapshot, ['--skip-tests']), 3)
            self.assertEqual(len(calls), 3)
            receipt = json.loads((root / 'dist/deploys' / snapshot / 'source.json').read_text())
            self.assertEqual(receipt, {'commit': snapshot, 'shipExitCode': 3,
                'packageSha256': hashlib.sha256(b'package fixture').hexdigest()})
            self.assertEqual(git('worktree', 'list', '--porcelain').count('worktree '), 1)
            self.assertEqual((root / 'input.txt').read_text(), 'concurrent edit')
