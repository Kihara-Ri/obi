import subprocess
import unittest

from tools import check_android_line as line


class AndroidLineTests(unittest.TestCase):
    def test_line_base(self):
        self.assertEqual(line.line_base('v3.6.37'), 'v3.6.0')
        self.assertIsNone(line.line_base('v3.7.0'))
        self.assertIsNone(line.line_base('v3.6.37-2-gabc'))

    def test_minor_release_may_change_native_shell(self):
        self.assertEqual(line.native_changes('v3.7.0', 'HEAD'), [])

    def test_patch_with_native_changes_is_rejected(self):
        # v3.6.22–v3.6.37 改了 MainActivity 却只发了网页补丁：闸门必须拦下这种情况
        has_tags = subprocess.run(['git', 'rev-parse', '-q', '--verify', 'refs/tags/v3.6.0'],
                                  capture_output=True, cwd=line.root).returncode == 0
        if not has_tags:
            self.skipTest('浅克隆没有历史 tag')
        self.assertIn('android/app/src/main/java/io/github/kihara_ri/obi/MainActivity.java',
                      line.native_changes('v3.6.37'))


if __name__ == '__main__':
    unittest.main()
