"""Claude 官方 CLI 边界：隔离授权、无工具照片输入、真实模型/强度元数据。"""
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from domain import ValidationError


class ClaudeTests(unittest.TestCase):
    def test_environment_and_inference_do_not_use_existing_or_api_credentials(self):
        from server.listing_claude import ClaudeProvider
        with tempfile.TemporaryDirectory() as directory:
            provider = ClaudeProvider(Path(directory))
            observed = {}
            def run(command, **kwargs):
                observed.update(command=command, **kwargs)
                return SimpleNamespace(returncode=0, stdout=json.dumps({'type': 'result', 'is_error': False,
                    'result': '{"pending":["需补拍"]}'}))
            with patch('server.listing_claude.shutil.which', return_value='/test/claude'), \
                    patch.dict('os.environ', {'ANTHROPIC_API_KEY': 'must-not-use', 'CLAUDE_CODE_OAUTH_TOKEN': 'must-not-use'}), \
                    patch('server.listing_claude.subprocess.run', side_effect=run):
                output = provider.analyze('prompt', {'artist': 'A', 'title': 'B'}, [(0, '.jpg', b'photo')], 'opus', 'high')
            self.assertIn('需补拍', output)
            self.assertNotIn('ANTHROPIC_API_KEY', observed['env'])
            self.assertNotIn('CLAUDE_CODE_OAUTH_TOKEN', observed['env'])
            self.assertEqual(observed['env']['CLAUDE_CONFIG_DIR'], str(provider.directory))
            self.assertIn('--no-session-persistence', observed['command'])
            self.assertEqual(observed['command'][observed['command'].index('--tools') + 1], '')
            self.assertEqual(observed['command'][-2:], ['--effort', 'high'])
            content = json.loads(observed['input'])['message']['content']
            self.assertEqual(content[-1]['source']['data'], 'cGhvdG8=')

    def test_model_catalogue_comes_from_initialization_without_user_inference(self):
        from server.listing_claude import ClaudeProvider
        with tempfile.TemporaryDirectory() as directory:
            provider = ClaudeProvider(Path(directory))
            with patch('server.listing_claude.shutil.which', return_value='/test/claude'), \
                    patch.object(provider, 'run', return_value=json.dumps({'type': 'control_response', 'response': {
                        'response': {'models': [{'value': 'sonnet', 'supportedEffortLevels': ['low', 'high']}]}}})) as runner:
                rows = provider.models()
                self.assertEqual(rows[0]['value'], 'sonnet')
                request = json.loads(runner.call_args.kwargs['input'])
                self.assertEqual(request['request']['subtype'], 'initialize')

    def test_error_result_is_not_treated_as_success(self):
        from server.listing_claude import ClaudeProvider
        with tempfile.TemporaryDirectory() as directory:
            provider = ClaudeProvider(Path(directory))
            with patch('server.listing_claude.shutil.which', return_value='/test/claude'), \
                    patch.object(provider, 'run', return_value='{"type":"result","is_error":true,"result":"error"}'):
                with self.assertRaises(ValidationError): provider.analyze('p', {'title': 'B', 'artist': 'A'}, [], 'opus', '')

    def test_pending_login_and_identity_change_reject_inference_before_cli(self):
        from server.listing_claude import ClaudeProvider
        with tempfile.TemporaryDirectory() as directory:
            provider = ClaudeProvider(Path(directory))
            with patch.object(provider.login, 'status', return_value={'loginPending': True}), patch.object(provider, 'run') as run:
                with self.assertRaises(ValidationError): provider.analyze('p', {}, [], 'm', '', account='old')
                run.assert_not_called()
            with patch.object(provider, 'status', return_value={'connected': True, 'accountId': 'new'}), patch.object(provider, 'run') as run:
                with self.assertRaises(ValidationError): provider.models(account='old')
                run.assert_not_called()

    def test_auth_changes_are_rejected_during_active_inference(self):
        import threading
        from server.listing_claude import ClaudeProvider
        with tempfile.TemporaryDirectory() as directory:
            provider = ClaudeProvider(Path(directory))
            entered, release = threading.Event(), threading.Event()
            def active():
                with provider.session():
                    entered.set(); release.wait(5)
            worker = threading.Thread(target=active)
            worker.start(); self.assertTrue(entered.wait(2))
            try:
                with self.assertRaises(ValidationError): provider.login.start()
                with self.assertRaises(ValidationError): provider.disconnect()
            finally: release.set(); worker.join(2)

    def test_cancel_waits_for_child_exit_before_clearing_pending(self):
        import subprocess
        from unittest.mock import Mock
        from server.listing_claude import ClaudeProvider
        with tempfile.TemporaryDirectory() as directory:
            provider = ClaudeProvider(Path(directory))
            child = Mock()
            child.poll.return_value = None
            seen = []
            def wait(timeout):
                seen.append(provider.login.pending)
                if len(seen) == 1: raise subprocess.TimeoutExpired('test-child', timeout)
                return 0
            child.wait.side_effect = wait
            provider.login.process = child; provider.login.pending = True
            provider.login.cancel()
            self.assertEqual(seen, [True, True])
            child.terminate.assert_called_once(); child.kill.assert_called_once()
            self.assertFalse(provider.login.pending)
