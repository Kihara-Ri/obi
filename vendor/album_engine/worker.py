"""Engine-owned generation coordinator with host-provided task/material ports.

Discovery, understanding, compilation and publication rules stay in this
standalone package. Hosts retain lease-fenced atomic persistence operations.
"""
import threading
from copy import deepcopy
from .ports import TaskPort, VisionPort, CatalogPort
from pathlib import Path
from .errors import ValidationError, ConflictError
from uuid import uuid4

def uid(): return uuid4().hex
from .contracts import SKILL_VERSION, clean_barcode
from .errors import SourceUnavailable, BadSource
from .errors import NeedsInput, Stopped, ArtNotFound
# Re-export historical client names for existing integration tests and callers.
from .sources import ArtClient, DiscogsClient, DiscogsRedirect, ArtRedirect, discogs_image_url, SourceDiscovery
from .surfaces import SurfaceUnderstanding
from .assembly import GeometryAssembly, rows_match_manual_region


class DigitalTwinService:
    def __init__(self, store: TaskPort, vision: VisionPort, mb: CatalogPort, art=None, discogs=None):
        self.store = store; self.vision = vision; self.mb = mb; self.art = art or ArtClient()
        self.discogs = discogs or DiscogsClient()
        self.owner = uid(); self.stop_event = threading.Event(); self.wake = threading.Event()
        self.current_lock = threading.Lock(); self.current = None; self.thread = None
        self.skill = (Path(__file__).parent / 'skill/SKILL.md').read_text()
        self.runtime = (Path(__file__).parent / 'skill/references/runtime-agent.md').read_text()

    def index(self):
        return self.store.twin_index() | {'configured': self.vision.public_config()['configured'], 'skill': SKILL_VERSION}

    def start_task(self, body):
        result = self.store.start_twin(body); self.wake.set(); return result

    def confirm(self, body):
        result = self.store.confirm_twin(body.get('id'), body.get('releaseId'), self.vision.public_config()['configured'])
        self.wake.set(); return result

    def update_accessories(self, body):
        """Enrich an already published entity without regenerating its main case."""
        from .guided import candidate_images
        from .contracts import image_type, clean_accessory_selection, clean_accessories
        if not isinstance(body, dict) or not isinstance(body.get('id'), str):
            raise ValidationError('附件更新任务无效')
        parts = body.get('components')
        if not isinstance(parts, list) or len(parts) > 8:
            raise ValidationError('最多支持八个附件')
        registry, job = self.store.task_snapshot(body['id'])
        if not job or job['status'] != 'succeeded' or registry.get('latest', {}).get(job['recordId']) != job['id']:
            raise ValidationError('只能更新当前已发布的数字实体')
        catalog = job.get('confirmedCatalog') or {}
        allowed = {i['sourceId'] for i in candidate_images(catalog)} | set(job.get('sources', {}))
        release_id = job['releaseId']
        # Images refer to the frozen catalog; not client-supplied URLs.
        selected = []
        for index, part in enumerate(parts):
            default = f'{part.get("kind")}-{index + 1}' if isinstance(part, dict) else None
            selected.append(clean_accessory_selection(part, allowed, default))
        if len({p['id'] for p in selected}) != len(selected): raise ValidationError('附件编号不能重复')
        # Do not hold the DB writer lock during external image fetches.
        cached = {}
        source_ids = [p['sourceId'] for p in selected] + [p['back']['sourceId'] for p in selected if p.get('back')]
        for sid in source_ids:
            if sid in cached: continue
            if sid in job.get('sources', {}):
                original = job['sources'][sid]
                raw = self.store.twin_source(job['id'], original['asset']).read_bytes()
                cached[sid] = (original, raw)
            elif sid.startswith('caa:'):
                ident = sid[4:]
                raw = self.art.image(release_id, ident)
                ext, mime = image_type(raw)
                cached[sid] = ({'asset':'caa-'+ident+'.'+ext,'mime':mime,'origin':'edition-reference',
                                'sourceUrl':'https://coverartarchive.org/release/'+release_id+'/'+ident+'.jpg'},raw)
            elif sid.startswith('discogs:'):
                image = next((item for ref in catalog.get('editionReferences', []) if ref.get('status') == 'verified'
                              for item in ref.get('images', []) if item['sourceId'] == sid),None)
                if not image: raise ValidationError('同版图片资料不完整')
                raw = self.discogs.image(image['url'])
                ext, mime = image_type(raw)
                _, ident, index = sid.split(':')
                cached[sid] = ({'asset':'discogs-'+ident+'-'+index+'.'+ext,'mime':mime,
                                'origin':'edition-reference','sourceUrl':image['url']},raw)
            elif sid.startswith('related-caa:'):
                _, rid, ident = sid.split(':')
                if not any(ref['releaseId'] == rid and any(i['sourceId'] == sid for i in ref['images'])
                           for ref in catalog.get('compatibleArtwork', [])):
                    raise ValidationError('跨版附件缺少封装一致性证据')
                raw = self.art.image(rid, ident)
                ext, mime = image_type(raw)
                cached[sid] = ({'asset':'caa-'+ident+'.'+ext,'mime':mime,
                                'origin':'compatible-edition-reference',
                                'sourceReleaseId':rid,
                                'sourceUrl':'https://coverartarchive.org/release/'+rid+'/'+ident+'.jpg'},raw)
            else: raise ValidationError('图片来源无效')
        old_parts = {part['id']:part for part in job.get('entity', {}).get('components', [])}
        for request, part in zip(parts, selected):
            # Legacy payloads intentionally establish no stable identity. An
            # explicit ID, kind and exact authorized source must all agree
            # before omitted metadata can mean "leave the saved value alone".
            old = old_parts.get(request.get('id'))
            source = cached[part['sourceId']][0]
            if not old or old['kind'] != part['kind'] or any(old.get(k) != source.get(k)
                    for k in ('asset','origin','sourceUrl','sourceReleaseId')):
                continue
            for field in ('region','fold'):
                if field not in request and field in old: part[field] = deepcopy(old[field])
            if 'back' not in request and old.get('back'):
                frozen = old['back']
                sid = 'saved-back:' + part['id']
                raw = self.store.twin_source(job['id'], frozen['asset']).read_bytes()
                cached[sid] = ({k:v for k,v in frozen.items() if k != 'region'}, raw)
                part['back'] = {'sourceId':sid, **({'region':deepcopy(frozen['region'])} if 'region' in frozen else {})}
        # Validate all inherited and explicit references through the same
        # publication contract before asking the host for its atomic write.
        clean_accessories(selected, {sid:meta for sid,(meta,_) in cached.items()})
        result = self.store.set_twin_accessories(job['id'], selected, cached)
        return result

    def guided_image(self, ident, ordinal, source_id=None):
        """Authenticated, bounded preview of one source frozen during review.

        Exact edition and compatible edition artwork is never inferred from
        titles or user-supplied URLs.
        """
        from .guided import candidate_images
        from .contracts import image_type
        from .errors import ValidationError
        registry, job = self.store.task_snapshot(ident)
        if not job or (job.get('generationMode') != 'guided' and job.get('status') != 'succeeded') or (registry or {}).get('latest', {}).get(job['recordId']) != ident:
            raise ValidationError('图片预览任务不可用')
        if not job.get('confirmedRelease'):
            raise ValidationError('请先确认发行版本')
        options = candidate_images(job.get('confirmedCatalog') or {})
        if source_id is not None:
            if not isinstance(source_id,str) or len(source_id)>128 or source_id not in {i['sourceId'] for i in options}:
                raise ValidationError('图片来源不在已核验图集中')
        else:
            if type(ordinal) is not int or not 0 <= ordinal < len(options):
                raise ValidationError('图片编号无效')
            source_id = options[ordinal]['sourceId']
        edition = job['releaseId']
        references = job['confirmedCatalog'].get('editionReferences', [])
        related = job['confirmedCatalog'].get('compatibleArtwork', [])
        if source_id.startswith('caa:'):
            raw = self.art.image(edition, source_id[4:], preview=True)
        elif source_id.startswith('discogs:'):
            image = next((i for ref in references if ref.get('status') == 'verified'
                          for i in ref.get('images', []) if i['sourceId'] == source_id), None)
            if not image: raise ValidationError('图片来源尚未经过同版验证')
            raw = self.discogs.image(image['url'])
        elif source_id.startswith('related-caa:'):
            ref_id = source_id.split(':')[1]; image_id = source_id.split(':')[-1]
            if not any(ref['releaseId'] == ref_id and any(i['sourceId'] == source_id for i in ref['images']) for ref in related):
                raise ValidationError('跨版图片没有兼容性证据')
            raw = self.art.image(ref_id, image_id, preview=True)
        else: raise ValidationError('预览图片来源无效')
        image_type(raw)
        return raw

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
                if job.get('generationMode') == 'guided' and not job.get('guidedSelection'):
                    raise NeedsInput('请核对封装和图片表面，确认后再组装', 'awaiting_art_selection')
                entity = (self.generate_guided(job, step) if job.get('generationMode') == 'guided'
                          else self.generate(job, step))
                step('validating', '正在核对贴图、包装和副本版本')
                self.store.update_twin(job['id'], job['claim'], status='succeeded', phase='ready', message='数字实体已生成', entity=entity)
            else:
                review = self.lookup(job, step)
                selected = job.get('selectedReleaseId')
                if selected:
                    # Edition was confirmed in the album form and persisted before this job.
                    if job.get('generationMode') != 'guided' and not self.vision.public_config()['configured']:
                        raise NeedsInput('请先配置视觉模型，再重新生成数字实体', 'awaiting_generation')
                    self.store.update_twin(job['id'], job['claim'], **review,
                        status='needs_input' if job.get('generationMode') == 'guided' else 'queued',
                        phase='awaiting_art_selection' if job.get('generationMode') == 'guided' else 'queued_generation',
                        message='已复用已确认的发行版，等待生成数字实体', error='',
                        releaseId=selected, confirmedRelease=review['releaseData'][selected],
                        confirmedCatalog=review['artData'].get(selected, {}))
                    self.wake.set()
                else:
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

    def generate_guided(self, job, step):
        from .guided import generate_guided
        return generate_guided(self._discovery(), job, step)

    @staticmethod
    def _barcode(value):
        try: return clean_barcode(value)
        except ValidationError: return ''

    def _discovery(self):
        return SourceDiscovery(self.store, self.mb, self.art, self.discogs)

    def _understanding(self):
        return SurfaceUnderstanding(self.vision, self.store, self.skill, self.runtime)

    def read_barcode(self, job, step):
        return self._understanding().read_barcode(job, step)

    @staticmethod
    def release_summary(release):
        return SourceDiscovery.release_summary(release)

    def review_artwork(self, job, edition, step):
        return self._discovery().review_artwork(job, edition, step)

    def review_discogs(self, release, barcode, step):
        return self._discovery().review_discogs(release, barcode, step)

    def related_artwork(self, release, archive, references, step):
        return self._discovery().related_artwork(release, archive, references, step)

    def lookup(self, job, step):
        # Edition confirmation is upstream evidence. An empty barcode remains
        # empty; it does not authorize a second identification pass over photos.
        barcode = job.get('barcode', '')
        if not barcode and not job.get('selectedReleaseId'):
            barcode = self.read_barcode(job, step)
        return self._discovery().lookup(job, step, barcode)

    def own_faces_complete(self, job, cd_count):
        return GeometryAssembly(self.store).own_faces_complete(job, cd_count)

    def generate(self, job, step):
        if not self.vision.public_config()['configured']:
            raise NeedsInput('请先在设置中配置视觉模型，再重试生成')
        record = job['input']; edition = job['releaseId']
        release = job.get('confirmedRelease')
        if not release or release.get('id') != edition or self._barcode(release.get('barcode')) != job['barcode']:
            raise NeedsInput('请重新核对条形码并确认发行资料', 'awaiting_barcode')
        cd_count = sum(1 for medium in release.get('media', []) if 'CD' in str(medium.get('format', '')))
        if not 1 <= cd_count <= 4:
            raise NeedsInput('当前模板支持 1–4 张 CD，请核对介质或提供特殊包装资料')
        manual = record.get('packaging') or {}
        if manual.get('discs') and manual['discs'] != cd_count:
            raise NeedsInput('发行版碟数与已确认的包装碟数不一致，请选择对应版本')
        if record.get('pressing') == '日版' and release.get('country') not in ('JP', None):
            raise NeedsInput('这条发行资料不是日版，请核对副本与版本链接')

        # Immutable evidence identity before the model sees any image.
        discovery = self._discovery()
        assembly = GeometryAssembly(self.store)
        manifest = discovery.prepare(job, release, step, assembly.own_faces_complete(job, cd_count))
        interpreter = self._understanding()
        chosen = interpreter.plan(manifest.context, manual, manifest.allowed_ids, step)
        sources, previews = discovery.fetch_images(job, manifest, chosen, step)
        mapping = interpreter.build(manifest.context, chosen, previews, step)
        return assembly.assemble(mapping, job, release, sources, cd_count)
