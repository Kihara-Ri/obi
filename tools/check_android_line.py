"""安卓补丁版本闸门（D-023）：补丁 tag（vX.Y.Z，Z>0）相对 vX.Y.0 不得改原生外壳。

已安装的应用遇到同一 主.次 的新版本只下载网页内容包，不会重装安装包；补丁里改的 Java / 清单 / 资源
永远到不了用户手机（v3.6.22–v3.6.37 的沉浸展示修复就是这样全部落空的）。原生改动必须升次版本。

用法：python3 tools/check_android_line.py <tag> [ref]   （ref 默认等于 tag）
"""
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
NATIVE = ['android/app/src', 'android/app/build.gradle', 'android/build.gradle', 'android/settings.gradle']
TAG = re.compile(r'^v(\d+)\.(\d+)\.(\d+)$')


def line_base(tag):
    """补丁 tag 对应的次版本起点（v3.6.37 → v3.6.0）；非补丁或非正式 tag 返回 None。"""
    m = TAG.match(tag)
    if not m or m.group(3) == '0':
        return None
    return f'v{m.group(1)}.{m.group(2)}.0'


def native_changes(tag, ref=None):
    base = line_base(tag)
    if base is None:
        return []
    out = subprocess.run(['git', 'diff', '--name-only', base, ref or tag, '--', *NATIVE],
                         capture_output=True, text=True, check=True, cwd=root).stdout
    return [line for line in out.splitlines() if line]


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    changed = native_changes(argv[1], argv[2] if len(argv) > 2 else None)
    if changed:
        print(f'✗ {argv[1]} 是补丁版本，但相对 {line_base(argv[1])} 改了原生外壳（D-023：须升次版本）：')
        print('\n'.join(f'  {path}' for path in changed))
        return 1
    print(f'✓ {argv[1]}：原生外壳与次版本一致')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
