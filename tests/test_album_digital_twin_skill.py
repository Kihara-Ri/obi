"""Host compatibility entrypoints; helper semantics run in Album Engine CI."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import unittest

SCRIPTS = Path(__file__).resolve().parents[1] / 'server/skills/album-digital-twin/scripts'


class SkillEntrypointCompatibilityTests(unittest.TestCase):
    def test_legacy_script_imports_and_cli_help_delegate_to_packaged_runtime(self):
        for name, function in [('calibrate_spine', 'calibrate'), ('fetch_release_art', 'fetch')]:
            with self.subTest(script=name):
                path = SCRIPTS / (name + '.py')
                spec = importlib.util.spec_from_file_location('host_' + name, path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                self.assertTrue(callable(getattr(module, function)))
                result = subprocess.run([sys.executable, str(path), '--help'],
                                        capture_output=True, text=True, timeout=5)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('usage:', result.stdout)


if __name__ == '__main__':
    unittest.main()
