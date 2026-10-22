#!/usr/bin/env python3
"""Run backend test modules in parallel processes (stdlib only).

Same tests as `python3 -m unittest discover -s tests`; each module runs in its own
interpreter so module-level state never leaks between them. Slowest modules start
first so the wall time is close to the longest module, not the sum.

  python3 tools/run_tests.py            # all modules, one worker per CPU
  python3 tools/run_tests.py -j 1       # serial (same as unittest discover)
  python3 tools/run_tests.py test_covers test_web_app
"""
import argparse
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TESTS = ROOT / 'tests'
# Measured slowest first; unknown modules keep alphabetical order after these.
SLOW_FIRST = ('test_sample_bundle', 'test_web_app', 'test_updates', 'test_engine_plugins',
              'test_artists_routes', 'test_listing_providers', 'test_digital_twins')


def modules(names):
    found = sorted(path.stem for path in TESTS.glob('test_*.py'))
    if names:
        missing = [name for name in names if name not in found]
        if missing:
            sys.exit('没有这些测试模块：' + ', '.join(missing))
        found = list(names)
    rank = {name: index for index, name in enumerate(SLOW_FIRST)}
    return sorted(found, key=lambda name: (rank.get(name, len(rank)), name))


def run(name, verbose):
    started = time.monotonic()
    result = subprocess.run(
        [sys.executable, '-m', 'unittest', 'discover', '-s', str(TESTS), '-t', str(TESTS),
         '-p', name + '.py', '-v' if verbose else '-q'],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    return name, result.returncode, result.stdout, time.monotonic() - started


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('names', nargs='*', help='只跑这些模块（如 test_covers）')
    parser.add_argument('-j', '--jobs', type=int, default=os.cpu_count() or 2)
    parser.add_argument('-v', '--verbose', action='store_true')
    args = parser.parse_args()
    started, failed, total = time.monotonic(), [], 0
    with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
        for name, code, output, took in pool.map(lambda name: run(name, args.verbose), modules(args.names)):
            ran = re.search(r'^Ran (\d+) tests?', output, re.M)
            total += int(ran.group(1)) if ran else 0
            mark = '✓' if code == 0 else '✗'
            print(f'{mark} {name} ({took:.1f}s)', flush=True)
            if code != 0 or args.verbose:
                print(output, flush=True)
            if code != 0:
                failed.append(name)
    verdict = '失败：' + ', '.join(failed) if failed else '全部通过'
    print(f'{verdict}：{total} 项测试，{time.monotonic() - started:.1f}s')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
