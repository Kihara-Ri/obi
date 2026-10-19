"""治理文档一致性：tools/check_docs.py 必须全部通过（链接、路径、编号、索引登记）。"""
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class DocsGovernanceTests(unittest.TestCase):
    def test_governed_docs_pass_check(self):
        result = subprocess.run([sys.executable, str(ROOT / 'tools/check_docs.py')],
                                capture_output=True, text=True, cwd=ROOT)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
