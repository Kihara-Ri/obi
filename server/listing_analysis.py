"""有界的副本分析任务；慢模型请求不占写锁，结果由人确认后才写草稿。"""
import copy
import re
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from domain import ValidationError
from .listing_photos import listing_record, read_photos
from .listing_generation import ListingGeneration


def catalogue_candidates(catalogue, analysis):
    candidates, error = {}, ''
    if not catalogue: return [], '发行资料库未配置'
    identifiers = [row for row in analysis['identifiers'] if row['kind'] in ('barcode', 'catalogNumber')]
    for row in identifiers[:4]:
        value = row['text'].strip()
        if row['kind'] == 'barcode' and not re.fullmatch(r'\d{8,14}', value): continue
        try:
            rows = catalogue.catalog({'title': '', 'artist': '', 'releaseInfo': {row['kind']: value}})
            for item in rows:
                if not item.get('identifierMatch'): continue
                info = item.get('releaseInfo', {})
                candidates[item['id']] = {key: str(item.get(key, '')) for key in ('id', 'title', 'artist')}
                candidates[item['id']].update({key: str(info.get(key, '')) for key in ('country', 'catalogNumber', 'barcode')})
                candidates[item['id']]['date'] = str(info.get('releaseDate', ''))
        except ValidationError as exc: error = str(exc)
    return list(candidates.values())[:30], error


class ListingAnalysis(ListingGeneration):
    def __init__(self, store, catalogue, model, inline=False):
        self.store, self.catalogue, self.model = store, catalogue, model
        # 本机模式不能起线程；服务器限制同时运行的任务数，避免大量照片耗尽资源。
        self.executor = None if inline else ThreadPoolExecutor(max_workers=4, thread_name_prefix='listing-analysis')
        self.lock = threading.Lock()
        self.jobs = {}

    def close(self):
        if self.executor: self.executor.shutdown(wait=True, cancel_futures=True)
        if hasattr(self.model, 'close'): self.model.close()

    def _reserve_job(self, job):
        # 调用者持锁：活动任务不能被清理，否则后台线程更新时会丢失任务。
        if any(j['status'] == 'running' and j['recordId'] == job['recordId'] for j in self.jobs.values()):
            raise ValidationError('这张副本已有任务正在生成，请完成后再试')
        while len(self.jobs) >= 20:
            finished = next((key for key, value in self.jobs.items() if value['status'] != 'running'), None)
            if finished is None: raise ValidationError('任务太多，请等待已有任务完成后再试')
            del self.jobs[finished]
        self.jobs[job['id']] = job

    def dismiss(self, ident):
        self.store.require_module('trading')
        with self.lock:
            job = self.jobs.get(ident)
            if job and job.get('status') != 'running': job['dismissed'] = True
        return {'ok': True}

    def start(self, data):
        record = listing_record(self.store, data.get('id'))
        if data.get('revision') != record['revision']: raise ValidationError('记录已变更，请重新打开')
        revision = record.get('photoRevision', 0)
        record, images = read_photos(self.store, record['id'], list(range(record.get('photoCount', 0))), data.get('photoRevision'))
        selection = self.model.snapshot() if hasattr(self.model, 'snapshot') else None
        with self.lock:
            ident = uuid.uuid4().hex
            job = {'id': ident, 'recordId': record['id'], 'status': 'running', 'photoRevision': revision}
            self._reserve_job(job)
        if self.executor: self.executor.submit(self._run, ident, record, images, revision, selection)
        else: self._run(ident, record, images, revision, selection)
        return dict(job)

    def _run(self, ident, record, images, revision, selection):
        try:
            listing_record(self.store, record['id'])
            analysis = self.model.analyze(record, images, selection) if selection is not None else self.model.analyze(record, images)
            candidates, error = catalogue_candidates(self.catalogue, analysis)
            current = listing_record(self.store, record['id'])
            if current.get('photoRevision', 0) != revision or current['revision'] != record['revision']:
                raise ValidationError('分析期间资料或照片已变更，请重新打开后分析')
            result = {**analysis, 'candidates': candidates, 'catalogError': error, 'photoRevision': revision}
            update = {'status': 'succeeded', 'analysis': result}
        except ValidationError as exc: update = {'status': 'failed', 'error': str(exc)}
        except Exception: update = {'status': 'failed', 'error': '照片分析失败，请重试'}
        with self.lock: self.jobs[ident].update(update)

    def status(self, ident='', record_id=''):
        self.store.require_module('trading')
        with self.lock:
            if ident:
                job = self.jobs.get(ident)
                if not job: raise ValidationError('任务不存在或服务已重启，请重新分析')
                return copy.deepcopy(job)
            if record_id:
                # 已被页面接收（采用、保留原稿或自动保存后已展示）的结果不再交给下次打开，免得旧结果回滚版本号。
                matched = [job for job in self.jobs.values() if job.get('recordId') == record_id
                           and (job.get('status') == 'running' or not job.get('dismissed'))]
                if matched:
                    running = next((j for j in reversed(matched) if j.get('status') == 'running'), None)
                    return copy.deepcopy(running or matched[-1])
                return {'status': 'idle'}
            raise ValidationError('缺少任务标识')
