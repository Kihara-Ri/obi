#!/usr/bin/env python3
"""Obi 入口：命令行参数、服务组装、启动服务。

HTTP 细节在 server/ 包；业务逻辑在根目录模块
（domain / storage / covers / rates / security / backups）。

    python3 app.py [--host 0.0.0.0] [--port 8765] [--data-dir DIR] [--public-origin https://…]

所有参数均可用环境变量 HOST / PORT / DATA_DIR / PUBLIC_ORIGIN 提供（Docker 用）。
"""
import argparse, getpass, os, signal, threading
from pathlib import Path
from urllib.parse import urlsplit
from http.server import ThreadingHTTPServer

from backups import Backups
from covers import CoverService
from musicbrainz import MusicBrainzClient
from server.discogs_catalog import DiscogsCatalog
from server.deezer_catalog import DeezerCatalog
from rates import RateService
from security import Auth
from server import Services, make_handler
from server.artists import ArtistService
from server.routes import WRITE_LOCK
from server.version import version
from server.release_catalog import ReleaseCatalog
from server.engine_plugins import PluginManager
from server.catalog_art import ArtClient
from server.shop_brands import ShopBrandService
from server.starter_albums import seed_starter
from storage import Store
from server.chatgpt_auth import ChatGPTAuth
from server.listing_model import ListingModel
from server.listing_analysis import ListingAnalysis

ROOT = Path(__file__).resolve().parent


def build(data_dir, public_origin=None):
    """从数据目录组装全部服务；无全局单例，测试可用临时目录构建。"""
    data = Path(data_dir)
    rates = RateService(data / 'rates.sqlite3')
    store = Store(data / 'albums.sqlite3', rates)
    mb = MusicBrainzClient()
    covers = CoverService(data / 'cover-cache.sqlite3', mb=mb)
    releases = ReleaseCatalog(mb=mb, discogs=DiscogsCatalog(), deezer=DeezerCatalog())
    plugins = PluginManager(store, None, mb)   # 宿主不提供视觉模型：数字实体的生成在 Album Engine 项目中
    return Services(store=store, shops=ShopBrandService(store), plugins=plugins, catalog_art=ArtClient(),
                    listings=ListingAnalysis(store, releases, ListingModel(ChatGPTAuth(data))),
                    auth=Auth(data / 'auth.sqlite3'),
                    covers=covers, releases=releases, twins=plugins.facade,
                    artists=ArtistService(store, mb, covers, write_lock=WRITE_LOCK),
                    rates=rates,
                    public_origin=public_origin)


def main():
    env = os.environ
    p = argparse.ArgumentParser()
    p.add_argument('--host', default=env.get('HOST', '127.0.0.1'))
    p.add_argument('--port', type=int, default=int(env.get('PORT', '8765')))
    p.add_argument('--data-dir', default=env.get('DATA_DIR', str(ROOT / 'data')))
    p.add_argument('--public-origin', default=env.get('PUBLIC_ORIGIN'))
    p.add_argument('--no-seed', action='store_true')
    p.add_argument('--set-password', action='store_true')
    args = p.parse_args()
    os.umask(0o077)
    Path(args.data_dir).mkdir(parents=True, exist_ok=True)
    if args.set_password:
        auth = Auth(Path(args.data_dir) / 'auth.sqlite3')
        password = getpass.getpass('设置登录密码（至少12个字符）：')
        if password != getpass.getpass('再次输入：'): raise SystemExit('两次密码不一致')
        auth.set_password(password); print('密码已设置'); return
    if args.public_origin:
        u = urlsplit(args.public_origin)
        if u.scheme != 'https' or not u.netloc or u.path or u.query or u.fragment:
            raise SystemExit('--public-origin 必须是 HTTPS 根地址')
    svc = build(args.data_dir, args.public_origin)
    if args.public_origin and not svc.auth.configured():
        raise SystemExit('请先使用 --set-password 设置密码')
    if not svc.auth.configured(): svc.auth = None  # 本机模式不启用登录
    if not args.no_seed:
        seed_starter(svc.store)  # 空库才写示例专辑
    svc.backups = Backups(svc.store.path); svc.backups.start()
    svc.artists.start_prewarm()  # 后台预取存量未绑定艺人（账本写入后的增量由路由触发）
    svc.twins.start()
    server = ThreadingHTTPServer((args.host, args.port), make_handler(svc))
    print(f'Obi 已启动：http://{args.host}:{args.port}（版本 {version()}）', flush=True)

    # 优雅停机：SIGTERM/SIGINT → 收完在途请求再退出（systemd / docker stop 不硬切）
    def stop(_signum, _frame):
        threading.Thread(target=server.shutdown, daemon=True).start()
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        svc.twins.stop()
        if svc.listings: svc.listings.close()
        svc.releases.close()
        print('Obi 已停止', flush=True)


if __name__ == '__main__':
    main()
