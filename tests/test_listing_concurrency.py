"""不同副本的识别可同时运行，同一副本和任务容量保持安全边界。"""
import tempfile
import threading
import unittest
from pathlib import Path
from domain import ValidationError
from server.listing_analysis import ListingAnalysis
from server.listing_claude import ClaudeProvider
from tools.seed_samples import open_store, seed_listing_photos


class ListingConcurrencyTests(unittest.TestCase):
    def test_distinct_records_run_together_and_duplicate_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            ids = seed_listing_photos(directory)
            store = open_store(directory)
            entered = [threading.Event(), threading.Event()]
            release = threading.Event()
            class Model:
                providers = type('Providers', (), {'snapshot': lambda self, **kw: {
                    'provider': 'api', 'model': 'fixture'}})()
                def analyze(self, record, images, selection, supplement=''):
                    entered[0 if record['id'] == ids['dookie-jp'] else 1].set()
                    if not release.wait(5): raise RuntimeError('timed out')
                    return {'versionText': record['title'], 'conditionText': ''}
                def write_copy(self, analysis, *args):
                    return {'title': analysis['versionText'], 'description': '说明'}
            service = ListingAnalysis(store, None, Model())
            self.addCleanup(service.close)
            records = {r['id']: r for r in store.state()['records']}
            def submit(key):
                r = records[ids[key]]
                return service.generate({'id': r['id'], 'revision': r['revision'],
                                         'photoRevision': r.get('photoRevision', 0)})
            try:
                first = submit('dookie-jp')
                self.assertTrue(entered[0].wait(2))
                with self.assertRaises(ValidationError): submit('dookie-jp')
                second = submit('lift-fists')
                self.assertTrue(entered[1].wait(2), '第二个任务没有并发进入模型')
                self.assertEqual(service.status(record_id=first['recordId'])['id'], first['id'])
                self.assertEqual(service.status(record_id=second['recordId'])['id'], second['id'])
            finally:
                release.set()
                service.executor.shutdown(wait=True)
            for job in (first, second):
                result = service.status(job['id'])
                self.assertEqual(result['status'], 'succeeded', result)
                self.assertTrue(result['autoSaved'])

    def test_claude_sessions_overlap_but_auth_changes_remain_exclusive(self):
        with tempfile.TemporaryDirectory() as directory:
            provider = ClaudeProvider(Path(directory))
            entered, release = threading.Event(), threading.Event()
            def active():
                with provider.session():
                    entered.set(); release.wait(5)
            worker = threading.Thread(target=active)
            worker.start()
            self.assertTrue(entered.wait(2))
            try:
                with provider.session(): pass
                with self.assertRaises(ValidationError): provider.login.start()
                with self.assertRaises(ValidationError): provider.disconnect()
            finally:
                release.set(); worker.join(2)

    def test_capacity_never_evicts_running_jobs(self):
        with tempfile.TemporaryDirectory() as directory:
            ids = seed_listing_photos(directory)
            store = open_store(directory)
            model = type('Model', (), {'providers': type('Providers', (), {
                'snapshot': lambda self, **kw: {'provider': 'api', 'model': 'fixture'}})()})()
            service = ListingAnalysis(store, None, model)
            self.addCleanup(service.close)
            service.jobs = {str(i): {'id': str(i), 'recordId': str(i), 'status': 'running'} for i in range(20)}
            r = next(r for r in store.state()['records'] if r['id'] == ids['dookie-jp'])
            with self.assertRaises(ValidationError):
                service.generate({'id': r['id'], 'revision': r['revision'], 'photoRevision': r.get('photoRevision', 0)})
            self.assertEqual(len(service.jobs), 20)
            self.assertEqual(service.status('0')['status'], 'running')


class ListingJobReplayTests(unittest.TestCase):
    def test_received_result_is_not_replayed_on_reopen(self):
        with tempfile.TemporaryDirectory() as directory:
            ids = seed_listing_photos(directory)
            store = open_store(directory)
            class Model:
                providers = type('Providers', (), {'snapshot': lambda self, **kw: {'provider': 'api', 'model': 'fixture'}})()
                def analyze(self, record, images, selection, supplement=''): return {'versionText': 'v', 'conditionText': ''}
                def write_copy(self, analysis, *args): return {'title': '标题', 'description': '说明'}
            service = ListingAnalysis(store, None, Model(), inline=True)
            self.addCleanup(service.close)
            record = next(r for r in store.state()['records'] if r['id'] == ids['dookie-jp'])
            job = service.generate({'id': record['id'], 'revision': record['revision'],
                                    'photoRevision': record.get('photoRevision', 0)})
            self.assertEqual(job['revision'], record['revision'])
            finished = service.status(record_id=record['id'])
            self.assertEqual(finished['status'], 'succeeded')
            self.assertEqual(finished['revision'], record['revision'])
            service.dismiss(job['id'])
            self.assertEqual(service.status(record_id=record['id']), {'status': 'idle'})
            self.assertEqual(service.status(job['id'])['id'], job['id'], '按编号仍可取回，供复用分析')
