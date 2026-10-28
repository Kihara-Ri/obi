"""照片分析的两种模型通道；OAuth 与 API 显式选择，不自动转付费通道。"""
import base64
import json
import re
import uuid
from domain import ValidationError
from domain_listing import clean_analysis
from .listing_provider_config import OPENCODE_FORBIDDEN, opencode_headers
from .listing_transport import request, responses_text

from .listing_prompts import ANALYSIS_PROMPT as PROMPT, COPY_PROMPT
from .listing_context import context_text


def image_content(record, images, supplement=''):
    content = [{'type': 'text', 'text': '已有资料：' + context_text(record) + '\n用户本次补充：' + supplement}]
    for index, ext, raw in images:
        mime = {'.jpg': 'jpeg', '.png': 'png', '.webp': 'webp'}[ext]
        content += [{'type': 'text', 'text': f'照片编号 {index}（从 0 开始）'},
                    {'type': 'image_url', 'image_url': {
                        'url': f'data:image/{mime};base64,' + base64.b64encode(raw).decode(), 'detail': 'high'}}]
    return content


def structured_json(raw):
    if isinstance(raw, str):
        raw = raw.strip().removeprefix('\ufeff')
        fenced = re.fullmatch(r'```(?:json)?\s*([\s\S]*?)\s*```', raw)
        if fenced: raw = fenced[1]
    try: return json.loads(raw)
    except (ValueError, TypeError): raise ValidationError('模型没有返回有效的分析 JSON，请重试') from None


def parse_analysis(raw, selected):
    data = structured_json(raw)
    result = clean_analysis(data)
    if not any(result[key] for key in ('identifiers', 'observations', 'pending', 'versionText', 'conditionText')):
        raise ValidationError('模型没有提供照片观察或待确认项，请重试')
    if not selected and (result['identifiers'] or result['observations']):
        raise ValidationError('无照片时不能生成照片观察')
    for row in result['identifiers'] + result['observations']:
        if any(index not in selected for index in row['photos']):
            raise ValidationError('模型引用了不存在的照片，请重试')
    # 候选版本只接受目录服务的真实查询；丢弃模型自称的候选及元信息。
    return {key: result[key] for key in ('identifiers', 'observations', 'pending', 'conflicts', 'versionText', 'conditionText', 'saleTerms')}


class ListingModel:
    def __init__(self, auth, providers=None):
        from .listing_providers import ListingProviders
        self.auth = auth
        self.providers = providers or ListingProviders(auth)

    def close(self):
        self.auth.cancel()
        with self.providers.claude.operation: self.providers.claude.login.cancel()

    def status(self, provider=None): return self.providers.status(provider)

    def snapshot(self): return self.providers.snapshot()

    def analyze(self, record, images, selection=None, supplement=''):
        settings = selection or self.providers.snapshot(require_images=bool(images))
        raw = self.complete(PROMPT, image_content(record, images, supplement), settings)
        return parse_analysis(raw, [index for index, _, _ in images])

    def write_copy(self, analysis, preset, has_photos, selection, record):
        from domain_listing import text
        from .listing_copy_clean import clean_title, hedge_hits, strip_hedges
        condition = analysis['conditionText']
        # 内部「尚未核实」标记与待核实/冲突清单不交给写作模型，否则它会照着写进买家可见的文案。
        if hedge_hits(condition): condition = ''
        payload = {
            'facts': {'album': {key: record[key] for key in ('artist', 'title')},
                      'versionText': analysis['versionText'], 'conditionText': condition, 'saleTerms': analysis['saleTerms'],
                      'tracklist': (record.get('releaseInfo') or {}).get('tracklist', []),
                      'media': (record.get('releaseInfo') or {}).get('media', [])},
            'versionConflict': bool(analysis['conflicts']),
            'style': preset['instructions'], 'hasPhotos': has_photos}
        content = [{'type': 'text', 'text': json.dumps(payload, ensure_ascii=False)}]

        def write(extra=None):
            parts = content + ([{'type': 'text', 'text': json.dumps(extra, ensure_ascii=False)}] if extra else [])
            value = structured_json(self.complete(COPY_PROMPT, parts, selection))
            if not isinstance(value, dict): raise ValidationError('模型文案格式无效')
            return {key: text(value.get(key), limit) for key, limit in (('title', 500), ('description', 50000))}
        result = write()
        hits = hedge_hits(result['title'], result['description'])
        if hits:  # 只重写一次；仍有残留时由 strip_hedges 删掉整句，不再调用模型。
            retry = write({'revise': '上一版含买家不该看到的不确定措辞：' + '、'.join(hits) + '。保持事实不变重写，删掉这些内容，不要提及未知信息。',
                           'previous': result})
            if all(retry.values()): result = retry
        result['title'] = clean_title(result['title']) or clean_title(f"{record['artist']} {record['title']}")
        result['description'] = strip_hedges(result['description'])
        if not result['description']: raise ValidationError('模型返回了空文案，请重试')
        return result

    def complete(self, prompt, content, settings):
        provider, model, effort = (settings[key] for key in ('provider', 'model', 'effort'))
        if provider == 'anthropic':
            return self.providers.claude.complete(prompt, content, model, effort, account=settings['account'])
        if provider == 'openai':
            token = self.auth.access_token(settings['account'])
            inputs = [{'type': 'input_text', 'text': part['text']} if part['type'] == 'text' else
                      {'type': 'input_image', 'image_url': part['image_url']['url'], 'detail': 'high'} for part in content]
            payload = {'model': model, 'instructions': prompt, 'input': [{'role': 'user', 'content': inputs}],
                       'store': False, 'stream': True}
            if effort: payload['reasoning'] = {'effort': effort}
            response = request('https://api.openai.com/v1/responses', json.dumps(payload).encode(),
                               {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}, stream=True)
            raw = responses_text(response)
        else:
            payload = {'model': model, 'messages': [{'role': 'system', 'content': prompt},
                        {'role': 'user', 'content': content}], 'response_format': {'type': 'json_object'}}
            if provider == 'opencode':
                # Console 把 OpenAI 请求翻译成模型原生协议：不发送 response_format（部分原生 API 没有该字段），
                # 会话头让网关在同一任务内复用路由与提示缓存。
                payload.pop('response_format')
                if effort: payload['reasoning_effort'] = effort
                headers = opencode_headers(settings['key'], 'ses_' + uuid.uuid4().hex)
                headers['Content-Type'] = 'application/json'
                url = settings['base'] + '/openai/v1/chat/completions'
            else:
                headers = {'Authorization': 'Bearer ' + settings['key'], 'Content-Type': 'application/json'}
                url = settings['base'] + '/chat/completions'
                if effort:
                    if provider == 'deepseek':
                        payload['thinking'] = {'type': 'disabled' if effort == 'none' else 'enabled'}
                        if effort != 'none': payload['reasoning_effort'] = effort
                    else: payload['reasoning_effort'] = effort
            extra = {'forbidden': OPENCODE_FORBIDDEN} if provider == 'opencode' else {}
            result = request(url, json.dumps(payload).encode(), headers, **extra)
            try: raw = result['choices'][0]['message']['content']
            except (KeyError, IndexError, TypeError): raise ValidationError('模型返回结构无效，请重试') from None
        return raw
