"""Bounded skill agent: release evidence -> original art -> calibrated entity -> atomic publication."""
import base64
import json
import re
import threading
import unicodedata
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError

from domain import ValidationError, ConflictError
from storage import uid
from twins import SKILL_VERSION, clean_entity, image_type


class NeedsInput(Exception):
    def __init__(self, message, candidates=()):
        super().__init__(message); self.candidates = list(candidates)


class Stopped(Exception): pass


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
            with build_opener(ArtRedirect()).open(Request(url, headers={'User-Agent': 'Diedu/2.4 (CD entity artwork)'}), timeout=35) as response:
                raw = response.read(limit + 1)
            if len(raw) > limit: raise ValidationError('实物图集资源过大')
            return raw
        except (HTTPError, URLError, TimeoutError, OSError):
            raise ValidationError('实物图集暂时无法获取，请稍后重试') from None

    def catalog(self, edition):
        try: return json.loads(self.read('https://coverartarchive.org/release/' + edition, 2 * 1024 * 1024))
        except (ValueError, UnicodeError): raise ValidationError('实物图集返回了无效资料') from None

    def image(self, edition, ident, preview=False):
        suffix = '-1200.jpg' if preview else '.jpg'
        return self.read(f'https://coverartarchive.org/release/{edition}/{ident}{suffix}', 24 * 1024 * 1024)


class DigitalTwinService:
    def __init__(self, store, vision, mb, art=None):
        self.store = store; self.vision = vision; self.mb = mb; self.art = art or ArtClient()
        self.owner = uid(); self.stop_event = threading.Event(); self.wake = threading.Event()
        self.current_lock = threading.Lock(); self.current = None; self.thread = None
        self.skill = (Path(__file__).parent / 'skills/album-digital-twin/SKILL.md').read_text()
        self.runtime = (Path(__file__).parent / 'skills/album-digital-twin/references/runtime-agent.md').read_text()

    def index(self):
        return self.store.twin_index() | {'configured': self.vision.public_config()['configured'], 'skill': SKILL_VERSION}

    def start_task(self, body):
        result = self.store.start_twin(body); self.wake.set(); return result

    def cancel(self, ident):
        return self.store.cancel_twin(ident)

    def start(self):
        if self.thread is not None: return
        self.thread = threading.Thread(target=self._loop, name='album-digital-twin', daemon=True); self.thread.start()

    def stop(self):
        self.stop_event.set(); self.wake.set()
        with self.current_lock: current = self.current
        if current: self.store.update_twin(current['id'], current['claim'], status='interrupted', error='生成服务已停止，请手动重试')

    def _loop(self):
        while not self.stop_event.is_set():
            try: ran = self.run_one()
            except Exception: ran = False
            if not ran: self.wake.wait(2); self.wake.clear()

    def run_one(self):
        job = self.store.claim_twin(self.owner)
        if not job: return False
        done = threading.Event()
        with self.current_lock: self.current = job
        def heartbeat():
            while not done.wait(20):
                if not self.store.heartbeat_twin(job['id'], job['claim']): return
        pulse = threading.Thread(target=heartbeat, name='entity-task-lease', daemon=True); pulse.start()
        def step(phase, message):
            if self.stop_event.is_set() or not self.store.update_twin(job['id'], job['claim'], phase=phase, message=message): raise Stopped()
        try:
            entity = self.generate(job, step)
            step('validating', '正在核对贴图、包装和副本版本')
            self.store.update_twin(job['id'], job['claim'], status='succeeded', phase='ready', message='数字实体已生成', entity=entity)
        except Stopped:
            if self.stop_event.is_set(): self.store.update_twin(job['id'], job['claim'], status='interrupted', error='生成服务已停止，请手动重试')
        except NeedsInput as exc:
            self.store.update_twin(job['id'], job['claim'], status='needs_input', error=str(exc), candidates=exc.candidates)
        except (ValidationError, ConflictError) as exc:
            self.store.update_twin(job['id'], job['claim'], status='failed', error=str(exc))
        except Exception:
            self.store.update_twin(job['id'], job['claim'], status='failed', error='生成 agent 处理失败，旧结果未发布，请重试')
        finally:
            done.set()
            with self.current_lock: self.current = None
        return True

    def generate(self, job, step):
        if not self.vision.public_config()['configured']: raise NeedsInput('请先在设置中配置视觉模型，再重试生成')
        record = job['input']; edition = job['releaseId']
        step('locating_release', '正在确认 CD 发行版本')
        if not edition:
            choices = self.vision.catalog({'title': record['title'], 'artist': record['artist'], 'releaseInfo': record['releaseInfo']})
            exact = [c for c in choices if c['identifierMatch']]
            if len(exact) == 1: edition = exact[0]['id']
            else: raise NeedsInput('请确认具体 CD 发行版本后继续生成', choices)
        release = self.mb.get('release/' + edition, {'fmt': 'json', 'inc': 'artist-credits+labels+recordings'})
        def normal(value):
            text = unicodedata.normalize('NFKC', value).casefold()
            text = re.sub(r'\byr\b', 'your', text)
            return re.sub(r'[^\w]', '', text)
        artist = ''.join(c.get('name', '') + c.get('joinphrase', '') for c in release.get('artist-credit', []) if isinstance(c, dict))
        digits = lambda value: re.sub(r'\D', '', value)
        barcode = record['releaseInfo'].get('barcode', '')
        identifiers_match = bool(barcode and digits(barcode) == digits(release.get('barcode', '')))
        if not identifiers_match and (normal(artist) != normal(record['artist']) or normal(release.get('title', '')) != normal(record['title'])):
            raise NeedsInput('发行版的专辑名称或艺人与当前副本不一致，请核对链接')
        cd_count = sum(1 for medium in release.get('media', []) if 'CD' in str(medium.get('format', '')))
        if not 1 <= cd_count <= 4: raise NeedsInput('当前模板支持 1–4 张 CD，请核对介质或提供特殊包装资料')
        manual_count = (record.get('packaging') or {}).get('discs')
        if manual_count and manual_count != cd_count: raise NeedsInput('发行版碟数与已确认的包装碟数不一致，请选择对应版本')
        if record.get('pressing') == '日版' and release.get('country') not in ('JP', None):
            raise NeedsInput('这条发行资料不是日版，请核对副本与版本链接')
        step('fetching_art', '正在读取同版实物图集')
        catalog = self.art.catalog(edition)
        images = [i for i in catalog.get('images', []) if str(i.get('id', '')).isdigit()][:40]
        catalog_ids = {str(i['id']): i for i in images}
        sources = dict(job['sources'])
        system = self.skill + '\n\n' + self.runtime
        context = {'record': record, 'requirements': job['instructions'], 'release': release,
                   'recordSources': list(sources), 'archiveImages': [{'id': str(i['id']), 'types': i.get('types', []), 'comment': i.get('comment', '')} for i in images]}
        step('planning', 'agent 正在选择实物素材')
        plan = self.vision.agent_json(system, 'PLAN 阶段。\n' + json.dumps(context, ensure_ascii=False),
                                      on_start=lambda: step('planning', 'agent 正在规划包装与贴图'))
        chosen = plan.get('sourceIds')
        if not isinstance(chosen, list) or not 1 <= len(chosen) <= 16 or any(not isinstance(s, str) for s in chosen):
            raise ValidationError('agent 的素材计划无效')
        manual = record.get('packaging') or {}
        mandated = ['photo:' + str(i) for i in manual.get('photos', {}).values()]
        chosen = list(dict.fromkeys(chosen + mandated))
        if len(chosen) > 16: raise NeedsInput('选中的实物图片过多，请先整理各面照片')
        visuals = []
        for number, source_id in enumerate(chosen):
            step('fetching_art', f'正在获取实物图（{number + 1}/{len(chosen)}）')
            if source_id in sources:
                source = sources[source_id]; raw = self.store.twin_source(job['id'], source['asset']).read_bytes()
                preview = raw
            elif source_id.startswith('caa:') and source_id[4:] in catalog_ids:
                ident = source_id[4:]; raw = self.art.image(edition, ident); ext, mime = image_type(raw)
                name = 'caa-' + ident + '.' + ext
                self.store.write_twin_source(job['id'], job['claim'], name, raw)
                source = {'asset': name, 'mime': mime, 'origin': 'edition-reference',
                          'sourceUrl': f'https://coverartarchive.org/release/{edition}/{ident}.jpg'}
                sources[source_id] = source
                preview = self.art.image(edition, ident, preview=True)
            else: raise ValidationError('agent 选择了图集中不存在的素材')
            ext, mime = image_type(preview)
            visuals.append('data:' + mime + ';base64,' + base64.b64encode(preview).decode())
        step('calibrating_faces', 'agent 正在校准内页、盘面与书脊')
        context['imageOrder'] = chosen
        result = self.vision.agent_json(system, 'BUILD 阶段。附图按 imageOrder 排列。\n' + json.dumps(context, ensure_ascii=False), visuals,
            on_start=lambda: step('calibrating_faces', 'agent 正在分析结构与校准贴图'))
        if result.get('needsInput'): raise NeedsInput(str(result.get('needsInput'))[:1000])
        package = result.get('packaging')
        if not isinstance(package, dict): raise ValidationError('agent 未返回包装资料')
        package = {**package, **{k: v for k, v in manual.items() if k not in ('photos', 'photoRegions') and v != 'unknown'}}
        if 'size' not in manual: package.pop('size', None)  # 图像比例不能伪装成实测毫米
        package['discs'] = manual.get('discs', cd_count)
        result['packaging'] = package
        surfaces = result.get('surfaces', {})
        for role, index in manual.get('photos', {}).items():
            surfaces[role] = {'sourceId': 'photo:' + str(index), 'region': manual.get('photoRegions', {}).get(role)}
        result['surfaces'] = surfaces
        try: entity = clean_entity(result, sources)
        except ValidationError as exc: raise NeedsInput(str(exc)) from None
        entity['release'] = {'id': edition, 'title': str(release.get('title', '')),
                             'url': 'https://musicbrainz.org/release/' + edition}
        entity['skill'] = SKILL_VERSION
        if 'size' not in manual: entity['warnings'].append('使用包装参考比例，未填写实测尺寸')
        return entity
