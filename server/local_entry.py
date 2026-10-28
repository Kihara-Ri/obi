"""浏览器本机模式入口：同一张路由表在 Pyodide（WebAssembly 里的 CPython）中直接处理 /api 请求。

没有服务器的人把 Obi 当静态站点打开：Service Worker 把 /api/* 转给页面里的 Web Worker，
Worker 调用本模块的 handle()，数据写进浏览器（见 static/local/engine-worker.js）。
有服务器时不会 import 本模块。决策见 docs/DECISIONS.md D-019。

浏览器与服务器的差别都在这里抹平，业务代码与路由表保持原样：
- 不能起线程：并发取封面的线程池换成就地执行，不启动后台预取/备份/生成线程；
- 没有 socket：urllib 的出站请求改走 Worker 里的同步 XHR（受 CORS 约束，不能自定义 User-Agent）；
- 没有文件锁：Pyodide 移除了 fcntl，装一个空实现（本机同一时刻只有一个窗口持有引擎，见 engine-worker.js 的 Web Lock）；
- 没有 HTTP 服务：用 LocalHandler 冒充 BaseHTTPRequestHandler 里路由实际用到的那几项。
"""
import io
import json
import os
import sys
import tempfile
import types
from concurrent.futures import Future
from email.parser import BytesHeaderParser
from pathlib import Path
from urllib import error, request
from urllib.parse import urlsplit

from domain import ConflictError, ValidationError
from . import routes


class _Headers(dict):
    """大小写不敏感的请求头，只实现路由读取用到的 get()。"""
    def __init__(self, items):
        super().__init__({str(k).lower(): v for k, v in dict(items).items()})

    def get(self, key, default=None):
        return super().get(str(key).lower(), default)


class LocalHandler:
    """路由只用到 path / headers / send() / not_modified() / client_address。"""
    client_address = ('browser', 0)

    def __init__(self, method, target, headers):
        self.command, self.path, self.headers = method, target, _Headers(headers)
        self.status, self.out_headers, self.body = 200, {}, b''

    def send(self, data, status=200, mime='application/json; charset=utf-8', filename=None,
             headers=None, cache=None, etag=None):
        if not isinstance(data, bytes):
            data = json.dumps(data, ensure_ascii=False).encode() if 'json' in mime else str(data).encode()
        self.status, self.body = status, data
        self.out_headers = {'Content-Type': mime, 'Cache-Control': cache or 'no-store'}
        if etag: self.out_headers['ETag'] = etag
        if filename: self.out_headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        self.out_headers.update(headers or {})

    def not_modified(self, etag, cache='no-store'):
        self.status, self.body = 304, b''
        self.out_headers = {'ETag': etag, 'Cache-Control': cache}


def build_local(data_dir):
    """从浏览器里的数据目录组装服务：账本、封面、发行资料、艺人资料与售卖辅助；无后台线程。"""
    from covers import CoverService
    from musicbrainz import MusicBrainzClient
    from rates import RateService
    from server import Services
    from server.artists import ArtistService
    from server.catalog_art import ArtClient
    from server.chatgpt_auth import ChatGPTAuth
    from server.discogs_catalog import DiscogsCatalog
    from server.engine_plugins import PluginManager
    from server.listing_analysis import ListingAnalysis
    from server.listing_model import ListingModel
    from server.release_catalog import ReleaseCatalog
    from storage import Store
    data = Path(data_dir)
    rates = RateService(data / 'rates.sqlite3')
    store = Store(data / 'albums.sqlite3', rates)
    mb = MusicBrainzClient()
    covers = CoverService(data / 'cover-cache.sqlite3', mb=mb)
    plugins = PluginManager(store, None, mb)   # 本机模式不带 plugins/ 目录：引擎显示为不可用
    artists = ArtistService(store, mb, covers, write_lock=routes.WRITE_LOCK)
    artists.prewarm_enabled = False
    releases = ReleaseCatalog(mb=mb, discogs=DiscogsCatalog())
    # 售卖辅助只在安卓原生中继可用时启用（D-030）：浏览器静态站点直连 OpenCode 会被 CORS 挡下。
    listings = None
    if os.getenv('OPENCODE_RELAY_BASE', '').strip():
        listings = ListingAnalysis(store, releases, ListingModel(ChatGPTAuth(data)), inline=True)
        with listings.model.providers.config.locked() as state:
            if state['provider'] in ('openai', 'anthropic'): state['provider'] = 'opencode'
    # Deezer 不返回 CORS 头，浏览器里的同步 XHR 取不到，本机模式只接 MusicBrainz 与 Discogs。
    return Services(store=store, plugins=plugins, catalog_art=ArtClient(), covers=covers,
                    releases=releases, twins=plugins.facade, listings=listings,
                    artists=artists, rates=rates)


class Engine:
    def __init__(self, data_dir, seed=True):
        self.svc = build_local(data_dir)
        if seed:   # 与 app.py 一致：空库首次写入两张示例专辑；外网查询引擎（不碰账本）不写
            from server.starter_albums import seed_starter
            seed_starter(self.svc.store)

    def dispatch(self, method, target, headers, body):
        h = LocalHandler(method, target, headers)
        path = urlsplit(target).path
        if not path.startswith('/api/'): h.send({'error': '接口不存在'}, 404); return h
        if path.startswith('/api/listing/') and self.svc.listings is None:
            h.send({'error': '浏览器本机模式不支持售卖照片识别；请用安卓安装包（OpenCode / DeepSeek）或服务器版'}, 400)
            return h
        try:
            if method == 'GET':
                fn = routes.resolve_get(path)
                if not fn: h.send({'error': '接口不存在'}, 404)
                else: fn(h, self.svc)
            elif path in routes.UPLOAD:
                # 整文件上传：请求体已在内存里，落到数据目录内的临时文件再交给同一个处理函数
                fn, limit = routes.UPLOAD[path]
                if not body or len(body) > limit: raise ValidationError('文件为空或过大')
                with tempfile.NamedTemporaryFile(prefix='.upload-', suffix='.zip', dir=self.svc.store.path.parent) as f:
                    f.write(body); f.flush()
                    with routes.WRITE_LOCK: fn(h, self.svc, f.name)
            else:
                payload = json.loads(body or b'{}')
                if not isinstance(payload, dict): raise ValidationError('请求格式不正确')
                found = routes.resolve_post(path)
                if not found: h.send({'error': '接口不存在'}, 404); return h
                fn, _auth, needs_lock = found
                if needs_lock:
                    with routes.WRITE_LOCK: fn(h, self.svc, payload)
                else: fn(h, self.svc, payload)
        except ConflictError as e:
            h.send({'error': str(e)}, 409)
        except (ValidationError, ValueError, TypeError, KeyError) as e:   # JSONDecodeError 是 ValueError
            h.send({'error': str(e)}, 400)
        except Exception:
            import traceback; traceback.print_exc()
            h.send({'error': '保存失败，请重试；输入内容仍保留' if method != 'GET' else '读取失败，请重试'}, 500)
        return h

    def handle(self, method, target, headers_json, body):
        """给 Worker 调用：返回 (状态码, 响应头 JSON, 响应体 bytes)。"""
        if hasattr(body, 'to_py'): body = bytes(body.to_py())
        h = self.dispatch(method, target, json.loads(headers_json or '{}'), body)
        return h.status, json.dumps(h.out_headers), h.body


class _Response(io.BytesIO):
    """urlopen 返回值的最小实现：read / status / headers / geturl / 上下文管理。"""
    def __init__(self, body, status, headers, url):
        super().__init__(body)
        self.status = self.code = status
        self.headers, self.url, self.msg = headers, url, ''

    def geturl(self): return self.url
    def getcode(self): return self.status
    def info(self): return self.headers


class _Inline:
    """就地执行的线程池替身：浏览器里不能起线程，任务按提交顺序依次完成。"""
    def __init__(self, *args, **kwargs): pass
    def __enter__(self): return self
    def __exit__(self, *exc): return False
    def shutdown(self, *args, **kwargs): pass

    def submit(self, fn, *args, **kwargs):
        future = Future()
        try: future.set_result(fn(*args, **kwargs))
        except BaseException as exc: future.set_exception(exc)
        return future


def install_browser_runtime(xhr):
    """xhr(method, url, headers_json, body, timeout_s) → {status, headers, body, url}（Worker 里的同步 XHR）。"""
    import concurrent.futures
    concurrent.futures.ThreadPoolExecutor = _Inline
    try: import fcntl  # noqa: F401
    except ImportError:
        stub = types.ModuleType('fcntl')
        stub.LOCK_SH, stub.LOCK_EX, stub.LOCK_NB, stub.LOCK_UN = 1, 2, 4, 8
        stub.flock = lambda *args: None
        sys.modules['fcntl'] = stub

    def open_(self, fullurl, data=None, timeout=30):
        req = request.Request(fullurl, data) if isinstance(fullurl, str) else fullurl
        if data is not None: req.data = data
        if urlsplit(req.full_url).scheme not in ('http', 'https'):
            raise error.URLError('unsupported scheme')
        body = req.data
        raw = xhr(req.get_method(), req.full_url, json.dumps(dict(req.header_items())),
                  body if body else None, timeout if isinstance(timeout, (int, float)) else 30)
        status = int(raw.status)
        if status == 0: raise error.URLError('network unreachable or blocked by CORS')
        headers = BytesHeaderParser().parsebytes((str(raw.headers).strip() + '\r\n\r\n').encode())
        response = _Response(bytes(raw.body.to_py()), status, headers, str(raw.url or req.full_url))
        if status >= 400:
            raise error.HTTPError(req.full_url, status, '', headers, response)
        return response
    request.OpenerDirector.open = open_
