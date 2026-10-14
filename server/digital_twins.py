"""Digital twin coordinator: worker lease, task state and atomic publication.

Discovery, image understanding and geometry assembly have isolated adapters.
The persisted v1 entity and task contracts remain unchanged.
"""
import threading
from pathlib import Path
from domain import ValidationError, ConflictError
from storage import uid
from twins import SKILL_VERSION, clean_barcode
from musicbrainz import SourceUnavailable, BadSource
from server.twin_errors import NeedsInput, Stopped, ArtNotFound
# Re-export historical client names for existing integration tests and callers.
from server.twin_sources import ArtClient, DiscogsClient, DiscogsRedirect, ArtRedirect, discogs_image_url, SourceDiscovery
from server.twin_surfaces import SurfaceUnderstanding
from server.twin_assembly import GeometryAssembly, rows_match_manual_region


class DigitalTwinService:
    def __init__(self, store, vision, mb, art=None, discogs=None):
        self.store = store; self.vision = vision; self.mb = mb; self.art = art or ArtClient()
        self.discogs = discogs or DiscogsClient()
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
                selected = job.get('selectedReleaseId')
                if selected:
                    # Edition was confirmed in the album form and persisted before this job.
                    if not self.vision.public_config()['configured']:
                        raise NeedsInput('请先配置视觉模型，再重新生成数字实体', 'awaiting_generation')
                    self.store.update_twin(job['id'], job['claim'], **review,
                        status='queued', phase='queued_generation',
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
        barcode = job.get('barcode') or self.read_barcode(job, step)
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
