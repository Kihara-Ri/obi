"""一键生成的真实模型适配/事务边界；所有副本来自固定样本，不调用真实服务商。"""
import copy
import json
import tempfile
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from domain import ValidationError
from server.listing_analysis import ListingAnalysis
from server.listing_model import ListingModel
from tools.seed_samples import seed_listing_photos, open_store


class GenerationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.ids = seed_listing_photos(self.tmp.name)
        self.store = open_store(self.tmp.name)
        self.calls = []
        self.providers = SimpleNamespace(snapshot=lambda **kwargs: {
            'provider': 'api', 'model': 'sample', 'effort': '', 'base': 'http://example.test', 'key': 'fixture'})
        self.model = ListingModel(None, self.providers)
        self.service = ListingAnalysis(self.store, None, self.model)
        self.addCleanup(lambda: self.service.executor.shutdown(wait=True))
        self.transport = patch('server.listing_model.request', side_effect=self.upstream)
        self.transport.start(); self.addCleanup(self.transport.stop)
        self.failed_copy = False
        self.conflicts = False

    def upstream(self, url, raw, headers):
        payload = json.loads(raw)
        self.calls.append(payload)
        if '只返回 JSON：' in payload['messages'][0]['content'] and '售卖文案助手' in payload['messages'][0]['content']:
            if self.failed_copy: raise ValidationError('文案生成暂时失败')
            facts = json.loads(payload['messages'][1]['content'][0]['text'])['facts']
            value = {'title': facts['album']['artist'] + ' ' + facts['album']['title'],
                     'description': facts['versionText'] + '\n' + facts['conditionText']}
        else:
            has_photos = any(row['type'] == 'image_url' for row in payload['messages'][1]['content'])
            value = {'identifiers': [], 'observations': [{'text': '盒面可见擦痕', 'photos': [0]}] if has_photos else [],
                     'pending': ['未确认播放状态'], 'conflicts': ['照片编号与记录不同'] if self.conflicts else [],
                     'versionText': '无争议版本说明' if self.conflicts else '已有发行资料中的版本',
                     'conditionText': '盒面可见擦痕' if has_photos else '实物品相尚未核实'}
        return {'choices': [{'message': {'content': json.dumps(value, ensure_ascii=False)}}]}

    def record(self, key):
        return next(r for r in self.store.state()['records'] if r['id'] == self.ids[key])

    def generate(self, key='dookie-jp', **extra):
        r = self.record(key)
        job = self.service.generate({'id': r['id'], 'revision': r['revision'],
                                     'photoRevision': r.get('photoRevision', 0), **extra})
        # 排队一个屏障，等待这次任务完成，仍允许同服务后续重试。
        self.service.executor.submit(lambda: None).result(timeout=5)
        return self.service.status(job['id'])

    def test_no_photos_generates_saves_and_omits_private_fields(self):
        before = self.record('dookie-jp')
        result = self.generate()
        self.assertEqual(result['status'], 'succeeded')
        self.assertTrue(result['autoSaved'])
        after = self.record('dookie-jp')
        self.assertEqual(after['revision'], before['revision'] + 1)
        for key in ('price', 'fees', 'location', 'status', 'releaseInfo', 'listed'):
            self.assertEqual(after.get(key), before.get(key))
        self.assertEqual(after['listingDraft']['conditionText'], '实物品相尚未核实')
        self.assertFalse(after['listingDraft']['conditionConfirmed'])
        context = self.calls[0]['messages'][1]['content'][0]['text']
        self.assertIn(before['releaseInfo']['catalogNumber'], context)
        self.assertNotIn(before['location'], context)
        self.assertNotIn('price', context)
        self.assertEqual(len(self.calls), 2)
        self.assertNotIn('image_url', str(self.calls))

    def test_photos_and_conflicts_are_preserved_but_old_copy_is_protected(self):
        first = self.generate('lift-fists')
        self.conflicts = True
        second = self.generate('lift-fists', reanalyze=True)
        self.assertEqual(second['status'], 'succeeded')
        self.assertFalse(second['autoSaved'])
        self.assertEqual(second['analysis']['conflicts'], ['照片编号与记录不同'])
        self.assertEqual(second['analysis']['observations'][0]['photos'], [0])
        self.assertEqual(self.record('lift-fists')['listingDraft'], first['draft'])
        self.assertIn('image_url', str(self.calls[0]))
        self.assertNotIn('image_url', str(self.calls[1]))

    def test_copy_failure_retains_analysis_and_retry_skips_multimodal_request(self):
        self.failed_copy = True
        first = self.generate('lift-fists')
        self.assertEqual(first['status'], 'failed')
        self.assertIn('analysis', first)
        self.assertNotIn('listingDraft', self.record('lift-fists'))
        self.failed_copy = False
        second = self.generate('lift-fists', analysisJobId=first['id'])
        self.assertEqual(second['status'], 'succeeded')
        self.assertEqual(len(self.calls), 3)
        self.assertNotIn('image_url', str(self.calls[-1]))

    def test_style_change_reuses_analysis_but_supplement_change_reanalyzes(self):
        first = self.generate()
        self.generate(presetId='collector', analysisJobId=first['id'])
        self.assertEqual(len(self.calls), 3)
        third = self.generate(supplement='盒盖有裂纹', analysisJobId=first['id'])
        self.assertEqual(len(self.calls), 5)
        self.assertEqual(third['draft']['generation']['supplement'], '盒盖有裂纹')

    def test_concurrent_edit_prevents_auto_save(self):
        original = self.model.write_copy
        def write(*args):
            r = self.record('dookie-jp')
            self.store.save({'id': r['id'], 'revision': r['revision'], 'title': r['title'] + '（已更正）'})
            return original(*args)
        with patch.object(self.model, 'write_copy', side_effect=write): result = self.generate()
        self.assertEqual(result['status'], 'failed')
        self.assertIn('已变更', result['error'])
        self.assertNotIn('listingDraft', self.record('dookie-jp'))

    def test_preferences_backup_conflict_validation_and_disabled_module(self):
        value = self.store.listing_preferences()
        value.update(customPresets=[{'id': 'custom', 'name': '自己的风格', 'instructions': '短句；保留瑕疵说明'}], defaultPreset='custom')
        saved = self.store.save_listing_preferences(value)
        with self.assertRaises(ValidationError): self.store.save_listing_preferences(value)
        self.store.restore_backup(copy.deepcopy(self.store.backup()))
        self.assertEqual(self.store.listing_preferences(), saved)
        result = self.generate()
        self.assertEqual(result['draft']['generation']['presetName'], '自己的风格')
        self.assertIn('短句', self.calls[-1]['messages'][1]['content'][0]['text'])
        bad = self.store.backup(); bad['settings']['listing-preferences-v1']['defaultPreset'] = 'missing'
        with self.assertRaises(ValidationError): self.store.restore_backup(bad)
        self.store.set_modules(dict(acquisition=True, trading=False, circulation=True, showcase=True))
        with self.assertRaises(ValidationError): self.store.listing_preferences()
        with self.assertRaises(ValidationError): self.generate()

    def test_no_photos_cannot_have_photo_evidence(self):
        from server.listing_model import parse_analysis
        with self.assertRaises(ValidationError):
            parse_analysis(json.dumps({'observations': [{'text': '无划痕', 'photos': [0]}]}), [])

    def test_model_json_fences_are_accepted_without_executing_text(self):
        from server.listing_model import structured_json
        self.assertEqual(structured_json('```json\n{"title":"标题"}\n```'), {'title': '标题'})
        with self.assertRaises(ValidationError): structured_json('提示：{"title":"未按协议返回"}')
