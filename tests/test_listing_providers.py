"""多服务商配置隔离、真实模型目录能力与请求强度；不访问个人凭据。"""
import json
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from domain import ValidationError
from server.chatgpt_auth import ChatGPTAuth


class ProviderTests(unittest.TestCase):
    def setUp(self):
        from server.listing_providers import ListingProviders
        self.tmp = tempfile.TemporaryDirectory()
        self.auth = ChatGPTAuth(Path(self.tmp.name))
        self.providers = ListingProviders(self.auth)

    def tearDown(self): self.tmp.cleanup()

    def connect(self):
        self.providers.connect({'provider': 'deepseek', 'apiKey': 'test-only-deepseek-key'})
        with patch('server.listing_providers.request', return_value={'data': [
            {'id': 'vision-model', 'display_name': '图片模型', 'input_modalities': ['text', 'image'],
             'effort': {'supported_levels': ['low', 'high', 'max']}},
            {'id': 'text-model', 'input_modalities': ['text']}]}):
            return self.providers.models('deepseek')

    def test_model_catalogue_controls_vision_and_actual_effort_levels(self):
        rows = self.connect()
        self.assertTrue(rows[0]['vision'])
        self.assertEqual(rows[0]['efforts'], ['none', 'low', 'high', 'max'])
        self.assertFalse(rows[1]['vision'])
        with self.assertRaises(ValidationError):
            self.providers.configure({'provider': 'deepseek', 'model': 'text-model', 'effort': ''})
        with self.assertRaises(ValidationError):
            self.providers.configure({'provider': 'deepseek', 'model': 'vision-model', 'effort': 'medium'})

    def test_switching_keeps_each_profile_and_never_exposes_keys(self):
        self.connect()
        self.providers.configure({'provider': 'deepseek', 'model': 'vision-model', 'effort': 'high'})
        self.providers.configure({'provider': 'openai'})
        self.providers.configure({'provider': 'deepseek'})
        status = self.providers.status()
        self.assertEqual(status['model'], 'vision-model')
        self.assertEqual(status['effort'], 'high')
        self.assertNotIn('test-only-deepseek-key', json.dumps(status))
        self.assertEqual(self.providers.config.path.stat().st_mode & 0o777, 0o600)

    def test_changed_key_invalidates_catalogue_and_selection(self):
        self.connect()
        self.providers.configure({'provider': 'deepseek', 'model': 'vision-model', 'effort': 'high'})
        self.providers.connect({'provider': 'deepseek', 'apiKey': 'another-test-key'})
        self.assertEqual(self.providers.status()['models'], [])
        with self.assertRaises(ValidationError): self.providers.snapshot()

    def test_deepseek_request_sends_real_thinking_parameters(self):
        from server.listing_model import ListingModel
        self.connect()
        self.providers.configure({'provider': 'deepseek', 'model': 'vision-model', 'effort': 'max'})
        model = ListingModel(self.auth, self.providers)
        observed = {}
        def upstream(url, data=None, headers=None, **kwargs):
            observed.update(url=url, body=json.loads(data), headers=headers)
            return {'choices': [{'message': {'content': '{"pending":["需补拍"]}'}}]}
        with patch('server.listing_model.request', side_effect=upstream):
            model.analyze({'title': 'B', 'artist': 'A'}, [(0, '.jpg', b'photo')])
        self.assertEqual(observed['body']['reasoning_effort'], 'max')
        self.assertEqual(observed['body']['thinking'], {'type': 'enabled'})
        self.assertEqual(observed['body']['model'], 'vision-model')
        self.assertEqual(observed['headers']['Authorization'], 'Bearer test-only-deepseek-key')

    def test_inflight_selection_is_frozen_when_user_switches(self):
        self.connect()
        self.providers.configure({'provider': 'deepseek', 'model': 'vision-model', 'effort': 'low'})
        selection = self.providers.snapshot()
        self.providers.configure({'provider': 'openai'})
        self.assertEqual(selection['provider'], 'deepseek')
        self.assertEqual(selection['effort'], 'low')

    def test_normalizers_use_openai_and_claude_model_metadata(self):
        from server.listing_capabilities import normalize_models
        rows = normalize_models('openai', [{'slug': 'model', 'display_name': 'Model',
            'input_modalities': ['text', 'image'], 'supported_reasoning_levels': [
                {'effort': 'low'}, {'effort': 'high'}, {'effort': 'xhigh'}]}])
        self.assertEqual(rows[0]['efforts'], ['low', 'high', 'xhigh'])
        rows = normalize_models('anthropic', [{'value': 'opus', 'displayName': 'Opus',
            'supportsEffort': True, 'supportedEffortLevels': ['low', 'medium', 'high', 'max']}])
        self.assertEqual(rows[0]['value'], 'opus')
        self.assertEqual(rows[0]['efforts'], ['low', 'medium', 'high', 'max'])

    def test_disconnect_suppresses_environment_fallback_until_explicit_reconnect(self):
        with patch.dict('os.environ', {'DEEPSEEK_API_KEY': 'test-environment-key'}):
            self.providers.configure({'provider': 'deepseek'})
            self.assertTrue(self.providers.status()['connected'])
            self.providers.disconnect('deepseek')
            self.assertFalse(self.providers.status()['connected'])
            self.providers.connect({'provider': 'deepseek', 'apiKey': 'test-saved-key'})
            self.assertTrue(self.providers.status()['connected'])

    def test_compatible_api_static_model_remains_ready_after_switch(self):
        with patch.dict('os.environ', {'LISTING_API_KEY': 'test-environment-key', 'LISTING_API_MODEL': 'test-model'}):
            self.providers.configure({'provider': 'api'})
            status = self.providers.status()
            self.assertTrue(status['ready'])
            self.assertEqual(status['model'], 'test-model')

    def test_openai_frozen_account_and_effort_are_sent_to_responses(self):
        from server.listing_model import ListingModel
        model = ListingModel(self.auth, self.providers)
        selection = {'provider': 'openai', 'model': 'test-openai-model', 'effort': 'high', 'account': 'original-account'}
        result = [{'type': 'response.completed', 'response': {'status': 'completed', 'output': [
            {'type': 'message', 'content': [{'type': 'output_text', 'text': '{"pending":["需补拍"]}'}]}]}}]
        with patch.object(self.auth, 'access_token', return_value='test-token') as token, \
                patch('server.listing_model.request', return_value=io.BytesIO(b'data: ' + json.dumps(result[0]).encode() + b'\n')) as upstream:
            model.analyze({'title': 'B', 'artist': 'A'}, [(0, '.jpg', b'photo')], selection)
            token.assert_called_once_with('original-account')
            payload = json.loads(upstream.call_args.args[1])
            self.assertEqual(payload['reasoning'], {'effort': 'high'})
            self.assertFalse(payload['store'])

    def test_deepseek_none_disables_thinking_without_unsupported_effort(self):
        from server.listing_model import ListingModel
        self.connect()
        self.providers.configure({'provider': 'deepseek', 'model': 'vision-model', 'effort': 'none'})
        with patch('server.listing_model.request', return_value={'choices': [{'message': {'content': '{"pending":["需补拍"]}'}}]}) as upstream:
            ListingModel(self.auth, self.providers).analyze({'title': 'B', 'artist': 'A'}, [(0, '.jpg', b'photo')])
            payload = json.loads(upstream.call_args.args[1])
            self.assertEqual(payload['thinking'], {'type': 'disabled'})
            self.assertNotIn('reasoning_effort', payload)

    def test_opencode_go_lane_reads_console_catalogue_and_ready(self):
        self.providers.connect({'provider': 'opencode', 'apiKey': 'test-opencode-key'})
        with patch('server.listing_providers.request', return_value={'data': [
                {'id': 'kimi-k3'}, {'id': 'gpt-6-luna'}]}) as upstream:
            rows = self.providers.models('opencode')
        self.assertEqual(upstream.call_args.args[0], 'https://opencode.ai/inference/go/v1/models')
        self.assertEqual(upstream.call_args.kwargs['headers']['Authorization'], 'Bearer test-opencode-key')
        self.assertEqual([row['value'] for row in rows], ['kimi-k3', 'gpt-6-luna'])
        self.assertIsNone(rows[0]['vision'])
        self.providers.configure({'provider': 'opencode', 'model': 'kimi-k3'})
        status = self.providers.status()
        self.assertEqual((status['provider'], status['lane'], status['ready']), ('opencode', 'go', True))
        self.assertEqual([row['id'] for row in status['providers']],
                         ['openai', 'deepseek', 'anthropic', 'opencode', 'api'])
        self.assertNotIn('test-opencode-key', json.dumps(status))
        self.assertEqual(self.providers.snapshot()['base'], 'https://opencode.ai/inference/go')

    def test_opencode_lanes_need_their_own_catalogue_and_selection(self):
        self.providers.connect({'provider': 'opencode', 'apiKey': 'test-opencode-key'})
        with patch('server.listing_providers.request', return_value={'data': [{'id': 'kimi-k3'}]}):
            self.providers.models('opencode')
        self.providers.configure({'provider': 'opencode', 'model': 'kimi-k3'})
        self.providers.configure({'provider': 'opencode', 'lane': 'zen'})
        status = self.providers.status()
        self.assertEqual((status['lane'], status['models'], status['model'], status['ready']),
                         ('zen', [], '', False))
        with patch('server.listing_providers.request', return_value={'data': [{'id': 'glm-5.3'}]}) as upstream:
            self.providers.models('opencode')
        self.assertEqual(upstream.call_args.args[0], 'https://opencode.ai/inference/v1/models')
        self.providers.configure({'provider': 'opencode', 'model': 'glm-5.3'})
        self.providers.configure({'provider': 'opencode', 'lane': 'go'})
        self.assertEqual((self.providers.status()['model'], self.providers.status()['ready']), ('kimi-k3', True))
        with self.assertRaises(ValidationError):
            self.providers.configure({'provider': 'opencode', 'lane': 'free'})

    def test_opencode_analysis_uses_console_chat_completions_with_session(self):
        from server.listing_model import ListingModel
        self.providers.connect({'provider': 'opencode', 'apiKey': 'test-opencode-key'})
        with patch('server.listing_providers.request', return_value={'data': [{'id': 'kimi-k3'}]}):
            self.providers.models('opencode')
        self.providers.configure({'provider': 'opencode', 'model': 'kimi-k3'})
        observed = {}
        def upstream(url, data=None, headers=None, **kwargs):
            observed.update(url=url, body=json.loads(data), headers=headers, kwargs=kwargs)
            return {'choices': [{'message': {'content': '{"pending":["需补拍"]}'}}]}
        with patch('server.listing_model.request', side_effect=upstream):
            ListingModel(self.auth, self.providers).analyze({'title': 'B', 'artist': 'A'}, [(0, '.jpg', b'photo')])
        self.assertEqual(observed['url'], 'https://opencode.ai/inference/go/openai/v1/chat/completions')
        self.assertTrue(observed['headers']['x-opencode-session'].startswith('ses_'))
        self.assertEqual(observed['headers']['User-Agent'], 'Obi-Album-Ledger')
        self.assertEqual(observed['body']['model'], 'kimi-k3')
        self.assertIn('image_url', str(observed['body']['messages']))
        self.assertNotIn('response_format', observed['body'])
        self.assertIn('OpenCode 客户端', observed['kwargs']['forbidden'])

    def test_opencode_forbidden_http_status_uses_specific_message(self):
        from urllib.error import HTTPError
        from server.listing_transport import request
        class Forbidden:
            def open(self, *args, **kwargs): raise HTTPError('https://example.test', 403, 'forbidden', {}, None)
        with patch('server.listing_transport.build_opener', return_value=Forbidden()):
            with self.assertRaises(ValidationError) as caught:
                request('https://example.test', forbidden='该模型可能仅限 OpenCode 客户端使用')
        self.assertEqual(str(caught.exception), '该模型可能仅限 OpenCode 客户端使用')

    def test_opencode_environment_key_disconnect_and_local_base(self):
        with patch.dict('os.environ', {'OPENCODE_API_KEY': 'test-env-open-code',
                                       'OPENCODE_API_BASE': 'http://127.0.0.1:9'}):
            self.providers.configure({'provider': 'opencode'})
            status = self.providers.status()
            self.assertTrue(status['connected'])
            self.assertEqual(status['keySource'], 'server')
            with patch('server.listing_providers.request', return_value={'data': [{'id': 'm'}]}) as upstream:
                self.providers.models('opencode')
            self.assertEqual(upstream.call_args.args[0], 'http://127.0.0.1:9/v1/models')
            self.providers.disconnect('opencode')
            self.assertFalse(self.providers.status()['connected'])
            self.providers.connect({'provider': 'opencode', 'apiKey': 'test-saved-open-code'})
            self.assertTrue(self.providers.status('opencode')['connected'])

    def test_opencode_rejects_plain_http_remote_base(self):
        with patch.dict('os.environ', {'OPENCODE_API_BASE': 'http://model.example.test'}):
            with self.assertRaises(ValidationError): self.providers.status('opencode')

    def test_opencode_uses_android_relay_base_when_present(self):
        from server.listing_provider_config import api_endpoint
        with patch.dict('os.environ', {'OPENCODE_RELAY_BASE': 'http://127.0.0.1:9/p/t/opencode'}):
            self.assertEqual(api_endpoint('opencode', {'opencodeLane': 'go'}),
                             'http://127.0.0.1:9/p/t/opencode/inference/go')
            self.assertEqual(api_endpoint('opencode', {'opencodeLane': 'zen'}),
                             'http://127.0.0.1:9/p/t/opencode/inference')


class ProviderPageTests(ProviderTests):
    def test_view_without_activating_and_connection_test_result(self):
        self.providers.connect({'provider': 'deepseek', 'apiKey': 'test-only-abcd'})
        view = self.providers.status('deepseek')
        self.assertEqual((view['provider'], view['inUse'], view['keyTail'], view['tested']), ('deepseek', False, 'abcd', None))
        self.assertNotEqual(self.providers.status()['provider'], 'deepseek')
        with patch('server.listing_providers.request', return_value={'data': [{'id': 'm'}]}):
            self.assertTrue(self.providers.test('deepseek')['tested']['ok'])
        with patch('server.listing_providers.request', side_effect=ValidationError('授权已失效')):
            tested = self.providers.test('deepseek')['tested']
        self.assertEqual((tested['ok'], tested['error']), (False, '授权已失效'))
        self.providers.connect({'provider': 'deepseek', 'apiKey': 'test-only-wxyz'})
        self.assertIsNone(self.providers.status('deepseek')['tested'])
