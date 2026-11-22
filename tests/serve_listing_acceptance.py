"""仅在固定样本上启动本机服务，供照片与历史上架资料浏览器验收。"""
import argparse
from http.server import ThreadingHTTPServer
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app import build
from server import make_handler
from tools.seed_samples import check_target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path, required=True)
    args = parser.parse_args()
    if check_target(args.data_dir):
        parser.error('请使用已准备好的固定样本实例')
    services = build(args.data_dir)
    services.auth = None
    with ThreadingHTTPServer(('127.0.0.1', 0), make_handler(services)) as server:
        print(f'ACCEPTANCE_URL=http://127.0.0.1:{server.server_port}', flush=True)
        server.serve_forever()


if __name__ == '__main__':
    main()
