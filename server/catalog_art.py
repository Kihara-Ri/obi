"""Core exact-edition CAA access; independent of the optional 3D engine."""
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from domain import ValidationError


class ArtNotFound(ValidationError): pass


class ArtRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urlsplit(newurl)
        if parsed.scheme != 'https' or parsed.username or parsed.password or not (
            parsed.hostname in ('coverartarchive.org', 'archive.org') or (parsed.hostname or '').endswith('.archive.org')):
            raise ValidationError('图集来源返回了不支持的跳转')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class ArtClient:
    def read(self, url, limit):
        try:
            with build_opener(ArtRedirect()).open(Request(url, headers={'User-Agent': 'Obi/2.4 (CD artwork)'}), timeout=35) as response:
                raw = response.read(limit + 1)
            if len(raw) > limit: raise ValidationError('实物图集资源过大')
            return raw
        except HTTPError as exc:
            if exc.code == 404: raise ArtNotFound('这一发行版本还没有实物图集') from None
            raise ValidationError('实物图集暂时无法获取，请稍后重试') from None
        except (URLError, TimeoutError, OSError):
            raise ValidationError('实物图集暂时无法获取，请稍后重试') from None

    def catalog(self, edition):
        try:
            result = json.loads(self.read('https://coverartarchive.org/release/' + edition, 2 * 1024 * 1024))
            if not isinstance(result, dict) or not isinstance(result.get('images'), list): raise ValueError()
            return result
        except (ValueError, UnicodeError): raise ValidationError('实物图集返回了无效资料') from None

    def image(self, edition, ident, preview=False):
        suffix = '-1200.jpg' if preview else '.jpg'
        return self.read(f'https://coverartarchive.org/release/{edition}/{ident}{suffix}', 24 * 1024 * 1024)

    def front(self, edition):
        """此发行版的正面图（1200px 预览）；没有正面图 → ArtNotFound。"""
        return self.read(f'https://coverartarchive.org/release/{edition}/front-1200', 24 * 1024 * 1024)
