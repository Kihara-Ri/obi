"""一键准备任务：两次推理、可复用分析、仅空白草稿自动保存；不改上架状态。"""
import copy
import hashlib
import json
import uuid
from domain import ValidationError
from domain_listing import clean_analysis, clean_draft, text
from domain_listing import select_preset
from .listing_context import public_context
from .listing_photos import listing_record, read_photos


class ListingGeneration:
    def generate(self, data):
        record = listing_record(self.store, data.get('id'))
        if data.get('revision') != record['revision']: raise ValidationError('记录已变更，请重新打开')
        revision = record.get('photoRevision', 0)
        if data.get('photoRevision') != revision: raise ValidationError('照片已变更，请重新打开')
        supplement = text(data.get('supplement', ''), 6000)
        preferences = self.store.listing_preferences()
        preset = select_preset(preferences, data.get('presetId', preferences['defaultPreset']))
        auto_save = data.get('autoSave', True)
        if type(auto_save) is not bool: raise ValidationError('自动保存选项无效')
        context_hash = hashlib.sha256(json.dumps([record['id'], public_context(record), revision, supplement],
                                                sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        analysis = None
        if not data.get('reanalyze'):
            saved = record.get('listingDraft', {})
            if saved.get('generation', {}).get('contextHash') == context_hash: analysis = saved.get('analysis')
            with self.lock:
                previous = self.jobs.get(data.get('analysisJobId', '')) or {}
                if previous.get('contextHash') == context_hash: analysis = previous.get('analysis', analysis)
        images = []
        if record.get('photoCount') and analysis is None:
            record, images = read_photos(self.store, record['id'], list(range(record['photoCount'])), revision)
        if record['revision'] != data.get('revision'): raise ValidationError('资料已变更，请重新打开')
        selection = self.model.providers.snapshot(require_images=bool(images))
        with self.lock:
            if any(job['status'] == 'running' for job in self.jobs.values()):
                raise ValidationError('已有售卖资料正在生成，请完成后再试')
            while len(self.jobs) >= 20: del self.jobs[next(iter(self.jobs))]
            ident = uuid.uuid4().hex
            job = {'id': ident, 'recordId': record['id'], 'status': 'running', 'phase': 'preparing',
                   'photoRevision': revision, 'contextHash': context_hash}
            self.jobs[ident] = job
            initial = copy.deepcopy(job)
        if self.executor: self.executor.submit(self._generate, ident, record, images, selection, preset, supplement,
                                               auto_save, analysis, context_hash)
        else: self._generate(ident, record, images, selection, preset, supplement, auto_save, analysis, context_hash)
        return initial

    def _update_generation(self, ident, **patch):
        with self.lock: self.jobs[ident].update(copy.deepcopy(patch))

    @staticmethod
    def _photo_order(record):
        # 沿用用户已设的首图 / 顺序（仅当照片没变且仍是完整排列），否则恢复默认顺序。
        count = record.get('photoCount', 0)
        saved = (record.get('listingDraft') or {})
        order = saved.get('photoOrder')
        if (saved.get('photoRevision') == record.get('photoRevision', 0) and isinstance(order, list)
                and sorted(order) == list(range(count))): return list(order)
        return list(range(count))

    def _check_generation(self, record):
        current = listing_record(self.store, record['id'])
        if current['revision'] != record['revision'] or current.get('photoRevision', 0) != record.get('photoRevision', 0):
            raise ValidationError('生成期间资料或照片已变更；已有草稿未覆盖，请重新打开')

    def _generate(self, ident, record, images, selection, preset, supplement, auto_save, analysis, context_hash):
        try:
            self._check_generation(record)
            if analysis is None:
                self._update_generation(ident, phase='analyzing')
                analysis = self.model.analyze(record, images, selection, supplement=supplement)
            analysis = clean_analysis({**analysis, 'photoRevision': record.get('photoRevision', 0)})
            if not record.get('photoCount') and not record.get('condition') and not supplement:
                analysis['conditionText'] = '实物品相尚未核实'
            self._check_generation(record)
            self._update_generation(ident, phase='writing', analysis=analysis)
            result = self.model.write_copy(analysis, preset, bool(record.get('photoCount')), selection, record)
            draft = clean_draft({**result, 'analysis': analysis, 'versionText': analysis['versionText'],
                'conditionText': analysis['conditionText'], 'versionConfirmed': False, 'conditionConfirmed': False,
                'photoRevision': record.get('photoRevision', 0), 'photoOrder': self._photo_order(record),
                'generation': {'presetId': preset['id'], 'presetName': preset['name'], 'instructions': preset['instructions'],
                               'supplement': supplement, 'contextHash': context_hash,
                               'sourceContext': json.dumps(public_context(record), sort_keys=True, ensure_ascii=False),
                               'provider': selection['provider'], 'model': selection['model']}})
            self._check_generation(record)
            existing = record.get('listingDraft') or {}
            protected = any(str(value or '').strip() for value in
                            (record.get('listingDescription'), existing.get('title'), existing.get('description')))
            saved = None
            if auto_save and not protected:
                self._update_generation(ident, phase='saving')
                from .routes import WRITE_LOCK
                with WRITE_LOCK:
                    saved = self.store.save_listing_draft({'id': record['id'], 'revision': record['revision'], 'draft': draft})
            self._update_generation(ident, status='succeeded', phase='done', draft=draft,
                                    autoSaved=saved is not None, savedRevision=saved['revision'] if saved else None)
        except ValidationError as exc: self._update_generation(ident, status='failed', error=str(exc))
        except Exception: self._update_generation(ident, status='failed', error='上架资料生成失败，请重试；已有草稿未覆盖')
