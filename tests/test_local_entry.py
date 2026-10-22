"""浏览器本机模式（server/local_entry.py）：路由分发与出站请求替换，不需要浏览器即可验证。"""
import concurrent.futures
import json
import tempfile
import unittest
from urllib import error, request

from server import local_entry


class FakeBody:
    def __init__(self, data): self.data = data
    def to_py(self): return self.data


class Raw:
    def __init__(self, status, body=b'', headers='content-type: application/json', url=''):
        self.status, self.body, self.headers, self.url = status, FakeBody(body), headers, url


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.engine = local_entry.Engine(self.tmp.name)

    def call(self, method, target, body=None):
        raw = json.dumps(body).encode() if body is not None else b''
        status, headers, out = self.engine.handle(method, target, '{}', raw)
        return status, json.loads(headers), out

    def state(self):
        return json.loads(self.call('GET', '/api/state')[2])

    def test_health_and_starter_state(self):
        status, _, out = self.call('GET', '/api/health')
        self.assertEqual((status, json.loads(out)['ok']), (200, True))
        status, headers, _ = self.call('GET', '/api/state')
        state = self.state()
        self.assertEqual(status, 200)
        self.assertEqual(len(state['records']), 2)           # 空库写入的两张示例专辑
        self.assertTrue(state['modules']['needsSetup'])      # 示例不算用户资料，仍进入功能选择引导
        self.assertFalse(state['service']['login'])           # 本机模式不启用登录
        self.assertIn('ETag', headers)

    def test_write_validation_and_unknown_routes(self):
        status, _, out = self.call('POST', '/api/records', {'title': '', 'artist': 'A'})
        self.assertEqual(status, 400)
        self.assertIn('error', json.loads(out))
        status, _, _ = self.call('POST', '/api/records',
                                 {'title': 'T', 'artist': 'A', 'price': '1000', 'currency': 'JPY'})
        self.assertEqual(status, 200)
        self.assertEqual(len(self.state()['records']), 3)
        self.assertEqual(self.call('GET', '/api/nope')[0], 404)
        self.assertEqual(self.call('GET', '/index.html')[0], 404)
        self.assertEqual(self.call('POST', '/api/nope', {})[0], 404)

    def test_backup_roundtrip_keeps_amounts_as_strings(self):
        self.call('POST', '/api/records', {'title': 'T', 'artist': 'A', 'price': '1000', 'currency': 'JPY'})
        backup = json.loads(self.call('GET', '/api/backup')[2])
        self.assertTrue(any(r['price'] == '1000.00' for r in backup['records']))
        with tempfile.TemporaryDirectory() as other:
            fresh = local_entry.Engine(other)
            fresh.svc.store.restore_backup(backup)
            self.assertTrue(any(r['price'] == '1000.00' for r in fresh.svc.store.state()['records']))


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.saved = (request.OpenerDirector.open, concurrent.futures.ThreadPoolExecutor)
        self.addCleanup(self.restore)

    def restore(self):
        request.OpenerDirector.open, concurrent.futures.ThreadPoolExecutor = self.saved

    def test_urlopen_goes_through_xhr(self):
        calls = []

        def xhr(method, url, headers, body, timeout):
            calls.append((method, url, json.loads(headers)))
            return Raw(200, b'{"ok":1}', 'content-type: application/json\r\nx-a: b', url)
        local_entry.install_browser_runtime(xhr)
        req = request.Request('https://example.test/x', headers={'Accept': 'application/json'})
        with request.urlopen(req, timeout=5) as r:
            self.assertEqual((r.status, r.read(), r.headers.get('X-A')), (200, b'{"ok":1}', 'b'))
        self.assertEqual(calls[0][:2], ('GET', 'https://example.test/x'))
        self.assertEqual(calls[0][2].get('Accept'), 'application/json')
        # 自带重定向处理器的 opener（各客户端的写法）同样经过替换后的 open
        opener = request.build_opener(request.HTTPRedirectHandler())
        self.assertEqual(opener.open('https://example.test/y').read(), b'{"ok":1}')

    def test_http_errors_and_network_failure(self):
        responses = iter([Raw(429, b'slow', 'retry-after: 3'), Raw(0)])
        local_entry.install_browser_runtime(lambda *a: next(responses))
        with self.assertRaises(error.HTTPError) as caught:
            request.urlopen('https://example.test/')
        self.assertEqual((caught.exception.code, caught.exception.headers.get('Retry-After')), (429, '3'))
        with self.assertRaises(error.URLError):
            request.urlopen('https://example.test/')

    def test_thread_pool_runs_inline(self):
        local_entry.install_browser_runtime(lambda *a: Raw(200))
        pool = concurrent.futures.ThreadPoolExecutor(max_workers=2)
        self.assertEqual(pool.submit(lambda: 7).result(), 7)
        self.assertIsInstance(pool.submit(lambda: 1 / 0).exception(), ZeroDivisionError)


if __name__ == '__main__':
    unittest.main()
