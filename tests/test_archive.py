"""完整备份包（server/archive.py）：账本与照片 / 封面一起往返，坏包与越界路径一律拒绝且不动现有数据。"""
import base64
import http.client
import io
import json
import tempfile
import threading
import unittest
import zipfile
from http.server import ThreadingHTTPServer
from pathlib import Path

from domain import ValidationError
from security import Auth
from server import Services, archive, local_entry, make_handler
from storage import Store

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
PNG_URL = 'data:image/png;base64,' + base64.b64encode(PNG).decode()


def rewrite(raw, change):
    """改写备份包：change(name, data) 返回新内容，返回 None 表示删掉该文件。"""
    out = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(raw)) as src, zipfile.ZipFile(out, 'w') as dst:
        for info in src.infolist():
            data = change(info.filename, src.read(info))
            if data is not None: dst.writestr(info.filename, data)
    return out.getvalue()


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.store = Store(self.root / 'a' / 'albums.sqlite3')
        self.rid = self.store.save({'title': 'Blue', 'artist': 'Joni', 'cover': PNG_URL, 'photos': [PNG_URL, PNG_URL]})['ids'][0]

    def restore_into_fresh(self, raw):
        other = Store(self.root / 'b' / 'albums.sqlite3')
        other.save({'title': '会被替换', 'artist': 'X', 'photos': [PNG_URL]})
        path = self.root / 'in.zip'; path.write_bytes(raw)
        return other, archive.restore(other, path)

    def test_roundtrip_keeps_ledger_photos_and_covers(self):
        raw = archive.build(self.store)
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            names = set(z.namelist())
            manifest = json.loads(z.read('manifest.json'))
        self.assertIn(f'photos/{self.rid}/0.png', names)
        self.assertTrue(any(n.startswith('covers/') for n in names))
        self.assertEqual(manifest['format'], archive.FORMAT)
        other, result = self.restore_into_fresh(raw)
        self.assertEqual(result['files'], len(names) - 2)
        records = other.state()['records']
        self.assertEqual([r['title'] for r in records], ['Blue'])
        self.assertEqual((other.photos_dir / self.rid / '1.png').read_bytes(), PNG)
        self.assertEqual({p.name for p in other.covers_dir.iterdir()}, {p.name for p in self.store.covers_dir.iterdir()})
        # 被替换的旧照片留在 pre-restore，账本另有恢复前快照
        kept = other.path.parent / 'backups' / 'pre-restore' / 'photos'
        self.assertEqual(len(list(kept.rglob('*.png'))), 1)
        self.assertTrue(list((other.path.parent / 'backups').glob('*.json')))

    def test_head_entries_readable_without_unzipping(self):
        # 网页（web/src/core/backup-file.ts）顺序读本地文件头取账本：前两项必须不压缩、头里带真实大小
        with zipfile.ZipFile(io.BytesIO(archive.build(self.store))) as z:
            head = z.infolist()[:2]
        self.assertEqual([i.filename for i in head], ['manifest.json', 'ledger.json'])
        for info in head:
            self.assertEqual(info.compress_type, zipfile.ZIP_STORED)
            self.assertFalse(info.flag_bits & 0x08)

    def test_bad_archives_leave_current_data_untouched(self):
        raw = archive.build(self.store)
        photo = f'photos/{self.rid}/0.png'
        cases = {
            '不是 zip': b'not a zip',
            '缺清单': rewrite(raw, lambda n, d: None if n == 'manifest.json' else d),
            '文件被改': rewrite(raw, lambda n, d: b'x' * len(d) if n == photo else d),
            '少了文件': rewrite(raw, lambda n, d: None if n == photo else d),
            '账本损坏': rewrite(raw, lambda n, d: b'{' if n == 'ledger.json' else d),
        }
        evil = io.BytesIO()
        with zipfile.ZipFile(evil, 'w') as z:
            z.writestr('manifest.json', json.dumps({'format': archive.FORMAT, 'version': 1,
                                                    'files': {'../escape.txt': {'size': 1, 'sha256': ''}}}))
            z.writestr('ledger.json', json.dumps(self.store.backup()))
            z.writestr('../escape.txt', b'x')
        cases['越界路径'] = evil.getvalue()
        for label, bad in cases.items():
            with self.subTest(label):
                other = Store(self.root / label / 'albums.sqlite3')
                other.save({'title': '原有', 'artist': 'X', 'photos': [PNG_URL]})
                path = self.root / (label + '.zip'); path.write_bytes(bad)
                with self.assertRaises(ValidationError): archive.restore(other, path)
                self.assertEqual([r['title'] for r in other.state()['records']], ['原有'])
                self.assertEqual(len(list(other.photos_dir.rglob('*.png'))), 1)
                self.assertFalse((self.root / 'escape.txt').exists())

    def test_newer_archive_version_is_refused(self):
        raw = rewrite(archive.build(self.store), lambda n, d: json.dumps({**json.loads(d), 'version': 99}).encode()
                      if n == 'manifest.json' else d)
        with self.assertRaisesRegex(ValidationError, '更新版本'): self.restore_into_fresh(raw)


class ArchiveHttpTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.store = Store(root / 'albums.sqlite3')
        auth = Auth(root / 'auth.sqlite3'); auth.set_password('test-password-12345')
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(Services(store=self.store, auth=auth)))
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.server_close); self.addCleanup(self.server.shutdown)

    def req(self, method, path, body=None, ctype=None, cookie=None):
        c = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        headers = {k: v for k, v in (('Content-Type', ctype), ('Cookie', cookie)) if v}
        c.request(method, path, body, headers); r = c.getresponse()
        out = (r.status, dict(r.getheaders()), r.read()); c.close(); return out

    def test_download_and_upload_restore(self):
        self.store.save({'title': 'Blue', 'artist': 'Joni', 'photos': [PNG_URL]})
        self.assertEqual(self.req('GET', '/api/backup')[0], 401)
        cookie = self.req('POST', '/api/login', json.dumps({'password': 'test-password-12345'}), 'application/json')[1]['Set-Cookie']
        status, headers, raw = self.req('GET', '/api/backup', cookie=cookie)
        self.assertEqual((status, headers['Content-Type']), (200, 'application/zip'))
        self.assertIn('obi-backup-', headers['Content-Disposition'])
        self.store.save({'title': '之后新增', 'artist': 'X'})
        self.assertEqual(self.req('POST', '/api/restore-archive', raw, 'application/zip')[0], 401)
        self.assertEqual(self.req('POST', '/api/restore-archive', raw, 'text/plain', cookie)[0], 415)
        status, _, body = self.req('POST', '/api/restore-archive', raw, 'application/zip', cookie)
        self.assertEqual(status, 200, body)
        self.assertEqual([r['title'] for r in self.store.state()['records']], ['Blue'])
        status, _, body = self.req('POST', '/api/restore-archive', b'junk', 'application/zip', cookie)
        self.assertEqual(status, 400); self.assertIn('不是有效的备份包', json.loads(body)['error'])

    def test_local_mode_upload_restore(self):
        with tempfile.TemporaryDirectory() as folder:
            engine = local_entry.Engine(folder)
            engine.svc.store.save({'title': 'Blue', 'artist': 'Joni', 'photos': [PNG_URL]})
            status, headers, raw = engine.handle('GET', '/api/backup', '{}', b'')
            before = [r['title'] for r in engine.svc.store.state()['records']]
            engine.svc.store.save({'title': '之后新增', 'artist': 'X'})
            status, _, body = engine.handle('POST', '/api/restore-archive', '{}', raw)
            self.assertEqual(status, 200, body)
            self.assertEqual([r['title'] for r in engine.svc.store.state()['records']], before)


if __name__ == '__main__':
    unittest.main()
