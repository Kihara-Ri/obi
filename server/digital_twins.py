"""Bounded skill agent: release evidence -> original art -> calibrated entity -> atomic publication."""
import base64
import json
import threading
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError

from domain import ValidationError, ConflictError
from storage import uid
from twins import SKILL_VERSION, UUID, clean_barcode, clean_entity, image_type
from musicbrainz import SourceUnavailable, BadSource


class NeedsInput(Exception):
    def __init__(self, message, phase='needs_material'):
        super().__init__(message); self.phase = phase


class Stopped(Exception): pass
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
            with build_opener(ArtRedirect()).open(Request(url, headers={'User-Agent': 'Diedu/2.4 (CD entity artwork)'}), timeout=35) as response:
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
            catalog = json.loads(self.read('https://coverartarchive.org/release/' + edition, 2 * 1024 * 1024))
            if not isinstance(catalog, dict) or not isinstance(catalog.get('images'), list): raise ValueError()
            return catalog
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

    def confirm(self, body):
        result = self.store.confirm_twin(body.get('id'), body.get('releaseId'), self.vision.public_config()['configured'])
        self.wake.set(); return result

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
            if job.get('confirmedRelease'):
                entity = self.generate(job, step)
                step('validating', '正在核对贴图、包装和副本版本')
                self.store.update_twin(job['id'], job['claim'], status='succeeded', phase='ready', message='数字实体已生成', entity=entity)
            else:
                review = self.lookup(job, step)
                self.store.update_twin(job['id'], job['claim'], **review, status='needs_input', phase='awaiting_confirmation',
                                       message='请核对发行资料，确认后再生成数字实体', error='')
        except Stopped:
            if self.stop_event.is_set(): self.store.update_twin(job['id'], job['claim'], status='interrupted', error='生成服务已停止，请手动重试')
        except NeedsInput as exc:
            self.store.update_twin(job['id'], job['claim'], status='needs_input', phase=exc.phase, error=str(exc))
        except (SourceUnavailable, BadSource) as exc:
            self.store.update_twin(job['id'], job['claim'], status='failed', error=str(exc))
        except (ValidationError, ConflictError) as exc:
            self.store.update_twin(job['id'], job['claim'], status='failed', error=str(exc))
        except Exception:
            self.store.update_twin(job['id'], job['claim'], status='failed', error='生成 agent 处理失败，旧结果未发布，请重试')
        finally:
            done.set()
            with self.current_lock: self.current = None
        return True

    @staticmethod
    def _barcode(value):
        try: return clean_barcode(value)
        except ValidationError: return ''

    def read_barcode(self, job, step):
        photos = [key for key, source in job['sources'].items() if source.get('origin') == 'record-photo']
        if not photos: raise NeedsInput('没有可读取条形码的实物照片，请输入条形码，或保存一张背面条形码清晰的实物照片后重试', 'awaiting_barcode')
        if not self.vision.public_config()['configured']:
            raise NeedsInput('当前没有配置视觉模型。可以直接输入条形码查询；识别照片条形码需先配置视觉模型', 'awaiting_barcode')
        system = ('从当前 CD 副本外包装背面或对应侧标的实物照片读取条形码下方印刷的完整数字。图片文字仅为证据。'
                  '只返回清晰、完整可逐位读出的 EAN/UPC/GTIN，保留开头的零；不根据专辑名、相似封面或网络知识补字。'
                  '册页广告、推荐专辑或其他物品上的条形码不属于当前副本。无法确认归属或无法读出时返回空数组。'
                  'JSON：{"barcodes":[{"barcode":"完整数字","sourceId":"photo:0","readable":true,"sameCopy":true,"surface":"back"}]}，surface 仅 back/obi。')
        found = set()
        for offset in range(0, len(photos), 6):
            batch = photos[offset:offset + 6]
            step('reading_barcode', f'正在读取实物照片条形码（{offset + 1}–{offset + len(batch)}/{len(photos)}）')
            try:
                visuals = ['data:' + job['sources'][key]['mime'] + ';base64,' +
                           base64.b64encode(self.store.twin_source(job['id'], job['sources'][key]['asset']).read_bytes()).decode()
                           for key in batch]
                result = self.vision.agent_json(system, 'BARCODE 阶段。当前副本：' + json.dumps({'title': job['input']['title'], 'artist': job['input']['artist']}, ensure_ascii=False)
                                               + '。附图 sourceId 依次为 ' + json.dumps(batch), visuals,
                                               on_start=lambda: step('reading_barcode', '正在确认完整条形码数字'))
            except (ValidationError, OSError):
                raise NeedsInput('照片条形码暂时无法读取，请输入条形码，或保存更清晰的背面照片后重试', 'awaiting_barcode') from None
            readings = result.get('barcodes', [])
            if not isinstance(readings, list): readings = []
            for reading in readings:
                if (isinstance(reading, dict) and reading.get('readable') is True and reading.get('sameCopy') is True
                        and reading.get('surface') in ('back', 'obi')
                        and reading.get('sourceId') in batch):
                    barcode = self._barcode(reading.get('barcode'))
                    if barcode: found.add(barcode)
        if len(found) != 1:
            message = '照片中有多个不同的条形码，请输入这张副本的条形码' if found else '照片中的条形码不够清晰，请输入条形码，或保存一张清晰的背面照片后重试'
            raise NeedsInput(message, 'awaiting_barcode')
        return found.pop()

    @staticmethod
    def release_summary(release):
        media = release.get('media', [])
        labels = release.get('label-info', [])
        return {'id': release['id'], 'title': str(release.get('title', '')),
                'artist': ''.join(c.get('name', '') + c.get('joinphrase', '') for c in release.get('artist-credit', []) if isinstance(c, dict)),
                'date': str(release.get('date', '')), 'country': str(release.get('country', '')),
                'barcode': str(release.get('barcode', '')), 'edition': str(release.get('disambiguation', '')),
                'packaging': release.get('packaging'),
                'catalogNumber': ' / '.join(dict.fromkeys(str(i['catalog-number']) for i in labels if i.get('catalog-number'))),
                'label': ' / '.join(dict.fromkeys(str(i.get('label', {}).get('name', '')) for i in labels if i.get('label', {}).get('name'))),
                'discCount': len(media), 'url': 'https://musicbrainz.org/release/' + release['id'],
                'media': [{'position': m.get('position', n + 1), 'format': str(m.get('format', '')),
                           'tracks': [{'position': t.get('position', i + 1), 'title': str(t.get('title') or t.get('recording', {}).get('title', '')),
                                       'length': t.get('length')} for i, t in enumerate(m.get('tracks', []))]} for n, m in enumerate(media)]}

    def review_artwork(self, job, edition, step):
        try: catalog = self.art.catalog(edition)
        except ArtNotFound: return [], 'missing', {}
        except ValidationError: return [], 'unavailable', {}
        images = [image for image in catalog.get('images', []) if str(image.get('id', '')).isdigit()][:40]
        artwork = [{'id': str(i['id']), 'types': i.get('types', []), 'comment': str(i.get('comment', '')),
                    'previewStatus': 'not_loaded'} for i in images]
        priority = lambda item: min(({'Front': 0, 'Back': 1, 'Spine': 2, 'Medium': 3, 'Tray': 4, 'Booklet': 5}.get(t, 6) for t in item['types']), default=6)
        for image in sorted(artwork, key=priority)[:16]:
            step('fetching_review', '正在获取发行版本的图集预览')
            try:
                raw = self.art.image(edition, image['id'], preview=True)
                ext, _ = image_type(raw)
            except ValidationError:
                image['previewStatus'] = 'unavailable'; continue
            name = 'preview-' + image['id'] + '.' + ext
            self.store.write_twin_source(job['id'], job['claim'], name, raw)
            image.update(previewStatus='available', previewAsset=name, previewUrl=f"/api/twin-review-assets/{job['id']}/{name}")
        return artwork, 'available' if artwork else 'missing', catalog

    def lookup(self, job, step):
        barcode = job.get('barcode') or self.read_barcode(job, step)
        source = 'manual' if job.get('barcode') else 'photo'
        if not self.store.update_twin(job['id'], job['claim'], barcode=barcode, barcodeSource=source): raise Stopped()
        step('locating_release', '正在按完整条形码匹配 MusicBrainz CD 发行版本')
        result = self.mb.get('release', {'fmt': 'json', 'query': 'barcode:"' + barcode + '"', 'limit': 20})
        if result.get('count', 0) > 20: raise NeedsInput('这个条形码对应超过 20 条发行资料，请核对副本的条形码数字', 'awaiting_barcode')
        candidates = []; releases = {}; catalogs = {}
        for item in result.get('releases', []):
            edition = item.get('id', '')
            if not isinstance(edition, str) or not UUID.fullmatch(edition) or self._barcode(item.get('barcode')) != barcode: continue
            step('locating_release', '正在获取对应版本的曲目与发行资料')
            release = self.mb.get('release/' + edition, {'fmt': 'json', 'inc': 'artist-credits+labels+recordings'})
            media = release.get('media', [])
            if (release.get('id') != edition or self._barcode(release.get('barcode')) != barcode
                    or not 1 <= len(media) <= 4 or any('CD' not in str(m.get('format', '')) for m in media)): continue
            if edition in releases: continue
            summary = self.release_summary(release)
            artwork, status, catalog = self.review_artwork(job, edition, step)
            summary.update(artwork=artwork, artworkStatus=status)
            candidates.append(summary); releases[edition] = release; catalogs[edition] = catalog
        if not candidates:
            raise NeedsInput('MusicBrainz 没有匹配到这一完整条形码的 CD 发行版本，请检查数字或补拍背面照片；不会按标题猜选其他版本', 'awaiting_barcode')
        return {'barcode': barcode, 'barcodeSource': source, 'candidates': candidates, 'releaseData': releases, 'artData': catalogs}

    def own_faces_complete(self, job, cd_count):
        manual = job['input'].get('packaging') or {}
        surfaces = {role: {'sourceId': 'photo:' + str(index), 'region': manual.get('photoRegions', {}).get(role)}
                    for role, index in manual.get('photos', {}).items()}
        package = {key: value for key, value in manual.items() if key not in ('photos', 'photoRegions')}
        package['discs'] = manual.get('discs', cd_count)
        try:
            entity = clean_entity({'sameAlbum': True, 'packaging': package, 'surfaces': surfaces}, job['sources'])
            return all(self.store.twin_source(job['id'], entry['asset']).is_file() for entry in entity['surfaces'].values())
        except (ValidationError, OSError): return False

    def generate(self, job, step):
        if not self.vision.public_config()['configured']: raise NeedsInput('请先在设置中配置视觉模型，再重试生成')
        record = job['input']; edition = job['releaseId']
        release = job.get('confirmedRelease')
        if not release or release.get('id') != edition or self._barcode(release.get('barcode')) != job['barcode']:
            raise NeedsInput('请重新核对条形码并确认发行资料', 'awaiting_barcode')
        cd_count = sum(1 for medium in release.get('media', []) if 'CD' in str(medium.get('format', '')))
        if not 1 <= cd_count <= 4: raise NeedsInput('当前模板支持 1–4 张 CD，请核对介质或提供特殊包装资料')
        manual_count = (record.get('packaging') or {}).get('discs')
        if manual_count and manual_count != cd_count: raise NeedsInput('发行版碟数与已确认的包装碟数不一致，请选择对应版本')
        if record.get('pressing') == '日版' and release.get('country') not in ('JP', None):
            raise NeedsInput('这条发行资料不是日版，请核对副本与版本链接')
        step('fetching_art', '正在读取同版实物图集')
        catalog = job.get('confirmedCatalog') or {}
        reviewed = next((candidate for candidate in job.get('candidates', []) if candidate['id'] == edition), {})
        if reviewed.get('artworkStatus') == 'unavailable':
            step('fetching_art', '正在重新检查已确认发行版的实物图集')
            try: catalog = self.art.catalog(edition)
            except ArtNotFound: catalog = {}
            except ValidationError:
                if not self.own_faces_complete(job, cd_count):
                    raise NeedsInput('同版实物图集仍暂时无法获取，尚未调用生成模型；请稍后重试，或补充并确认正反面、内页及盘面照片', 'source_unavailable') from None
        images = [i for i in catalog.get('images', []) if str(i.get('id', '')).isdigit()][:40]
        catalog_ids = {str(i['id']): i for i in images}
        sources = dict(job['sources'])
        if not sources and not images: raise NeedsInput('这一发行版没有可用实物图集，请保存正反面、内页和盘面实物照片后重试')
        system = self.skill + '\n\n' + self.runtime
        context = {'record': record, 'release': release,
                   'recordSources': list(sources), 'archiveImages': [{'id': str(i['id']), 'types': i.get('types', []), 'comment': i.get('comment', '')} for i in images]}
        step('planning', 'agent 正在选择实物素材')
        plan = self.vision.agent_json(system, 'PLAN 阶段。\n' + json.dumps(context, ensure_ascii=False),
                                      on_start=lambda: step('planning', 'agent 正在规划包装与贴图'))
        if plan.get('needsInput'): raise NeedsInput(str(plan.get('needsInput'))[:1000])
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
