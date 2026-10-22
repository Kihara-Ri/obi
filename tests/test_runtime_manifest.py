"""镜像与补丁包的运行时清单：两边口径一致，且只靠清单里的文件就能 import app（见 I-006）。"""
import importlib.util
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def runtime_copies():
    """Dockerfile 运行时阶段（最后一个 FROM 之后）里，从构建上下文 COPY 的源路径。"""
    stage = ROOT.joinpath('Dockerfile').read_text().split('\nFROM ')[-1]
    sources = []
    for line in stage.splitlines():
        parts = line.split()
        if parts[:1] == ['COPY'] and not any(p.startswith('--from') for p in parts):
            sources += parts[1:-1]
    return sources


def package_manifest():
    spec = importlib.util.spec_from_file_location('package_app', ROOT / 'tools' / 'package_app.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return {p.relative_to(ROOT).as_posix() for p in module.manifest()}


class RuntimeManifestTests(unittest.TestCase):
    def test_both_manifests_take_every_root_module(self):
        self.assertIn('*.py', runtime_copies())
        packaged = package_manifest()
        for module in ROOT.glob('*.py'):
            self.assertIn(module.name, packaged)

    def test_docker_runtime_files_are_enough_to_import_app(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)
            for source in runtime_copies():
                if source.startswith('static'):
                    continue
                for path in ROOT.glob(source.rstrip('/')):
                    dest = target / path.relative_to(ROOT)
                    if path.is_dir():
                        shutil.copytree(path, dest, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
                    else:
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(path, dest)
            result = subprocess.run([sys.executable, '-I', '-c', 'import sys; sys.path.insert(0, "."); import app'],
                                    cwd=target, capture_output=True, text=True, timeout=60)
            self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
