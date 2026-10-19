"""模型/OAuth 的受限 HTTP 传输：拒绝重定向，不把远端响应或凭据放进错误。"""
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, HTTPRedirectHandler
from domain import ValidationError


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl): return None


def request(url, data=None, headers=None, stream=False):
    try:
        response = build_opener(NoRedirect()).open(Request(url, data=data, headers=headers or {}), timeout=120)
        if stream: return response
        with response:
            raw = response.read(2 * 1024 * 1024 + 1)
        if len(raw) > 2 * 1024 * 1024: raise ValidationError('模型服务响应过大')
        return json.loads(raw) if raw else {}
    except HTTPError as exc:
        labels = {401: '授权已失效，请重新登录或检查 API 密钥', 403: '当前账号没有所需权限',
                  429: '模型额度不足或限流，请稍后重试'}
        raise ValidationError(labels.get(exc.code, f'模型服务返回 HTTP {exc.code}')) from None
    except (URLError, OSError, TimeoutError):
        raise ValidationError('无法连接模型服务或请求超时，请重试') from None
    except (ValueError, UnicodeError):
        raise ValidationError('模型服务未返回有效数据') from None


def responses_text(response):
    """必须收到 completed；拒绝将断流/拒绝/截断当成功。"""
    total = 0
    with response:
        for line in response:
            total += len(line)
            if total > 2 * 1024 * 1024: raise ValidationError('模型响应过大')
            if not line.startswith(b'data:'): continue
            raw = line[5:].strip()
            if raw == b'[DONE]': break
            try: event = json.loads(raw)
            except (ValueError, UnicodeError): raise ValidationError('模型事件格式无效') from None
            if event.get('type') in ('error', 'response.failed', 'response.incomplete'):
                raise ValidationError('模型未完成分析，请重试')
            if event.get('type') == 'response.completed':
                result = event.get('response', {})
                if result.get('status') != 'completed': break
                return ''.join(part.get('text', '') for item in result.get('output', [])
                               if item.get('type') == 'message' for part in item.get('content', [])
                               if part.get('type') == 'output_text')
    raise ValidationError('模型连接中断，分析未完成，请重试')
