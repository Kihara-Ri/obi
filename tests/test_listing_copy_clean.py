"""买家可见文案清洗：标题去括号引号，正文删除不确定措辞；写作模型拿不到内部待核实清单。"""
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from server.listing_copy_clean import clean_title, hedge_hits, strip_hedges
from server.listing_model import ListingModel


class CleanTests(unittest.TestCase):
    def test_title_drops_brackets_quotes_and_trailing_punctuation(self):
        self.assertEqual(clean_title('Green Day 《Dookie》【日版】「侧标」 CD。'), 'Green Day Dookie 日版 侧标 CD')
        self.assertEqual(clean_title('a (b) “c”'), 'a b c')

    def test_strip_hedges_removes_whole_sentences_only(self):
        text = '日版 CD，带侧标。\n品相不确定，需要看实物。盒面有轻微使用痕迹。\n以实物为准\n\n\n\n歌词本齐全。'
        self.assertEqual(strip_hedges(text), '日版 CD，带侧标。\n盒面有轻微使用痕迹。\n\n歌词本齐全。')

    def test_soft_words_trigger_retry_but_are_not_deleted(self):
        self.assertEqual(hedge_hits('盘面可能有划痕'), ['可能'])
        self.assertEqual(strip_hedges('盘面可能有划痕。'), '盘面可能有划痕。')


class WriteCopyTests(unittest.TestCase):
    def setUp(self):
        self.providers = SimpleNamespace(snapshot=lambda **kw: {'provider': 'api', 'model': 'm', 'effort': '', 'base': 'http://x', 'key': 'k'})
        self.model = ListingModel(None, self.providers)
        self.calls = []
        self.replies = []
        patcher = patch.object(ListingModel, 'complete', side_effect=self.complete)
        patcher.start(); self.addCleanup(patcher.stop)

    def complete(self, prompt, content, settings):
        self.calls.append(content)
        return json.dumps(self.replies.pop(0), ensure_ascii=False)

    def write(self, condition='实物品相尚未核实', conflicts=()):
        analysis = {'versionText': '日版', 'conditionText': condition, 'saleTerms': '', 'pending': ['待核实播放'], 'conflicts': list(conflicts)}
        return self.model.write_copy(analysis, {'instructions': '简洁'}, False, {'provider': 'api'},
                                     {'artist': 'Green Day', 'title': 'Dookie', 'releaseInfo': {}})

    def test_internal_markers_never_reach_the_writer(self):
        self.replies = [{'title': 'Green Day Dookie', 'description': '日版 CD'}]
        self.write(conflicts=['编号冲突'])
        sent = json.loads(self.calls[0][0]['text'])
        self.assertEqual(sent['facts']['conditionText'], '')
        self.assertTrue(sent['versionConflict'])
        self.assertNotIn('pending', sent); self.assertNotIn('conflicts', sent)
        self.assertNotIn('待核实播放', self.calls[0][0]['text'])

    def test_one_retry_on_hedging_then_sentence_stripped(self):
        self.replies = [{'title': '《Dookie》', 'description': '日版。品相不确定。'},
                        {'title': 'Green Day Dookie', 'description': '日版。需要看实物确认品相。盒面干净。'}]
        result = self.write()
        self.assertEqual(len(self.calls), 2)
        self.assertIn('不确定', self.calls[1][1]['text'])
        self.assertEqual(result, {'title': 'Green Day Dookie', 'description': '日版。盒面干净。'})

    def test_clean_first_reply_calls_model_once(self):
        self.replies = [{'title': 'Green Day Dookie 日版', 'description': '日版 CD'}]
        self.write(condition='盒面有轻微使用痕迹')
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(json.loads(self.calls[0][0]['text'])['facts']['conditionText'], '盒面有轻微使用痕迹')


if __name__ == '__main__':
    unittest.main()
