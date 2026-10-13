"""Shop brand metadata: bounded Pi call, cache reuse, no speculative shop rename."""
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from storage import Store
from server.shop_brands import ShopBrandService, infer_domain, normalize
from server.routes import api_records


PNG = b'\x89PNG\r\n\x1a\n' + b'x' * 20


class ShopBrandTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / 'albums.sqlite3')
        self.infer = Mock(return_value='hmv.co.jp')
        self.fetch = Mock(return_value=PNG)
        self.shops = ShopBrandService(self.store, infer=self.infer, fetch=self.fetch)

    def tearDown(self):
        self.shops.executor.shutdown(wait=True)
        self.tmp.cleanup()

    def test_new_shop_enriches_only_once_and_does_not_change_purchase_name(self):
        send = Mock()
        svc = SimpleNamespace(store=self.store, shops=self.shops, artists=None)
        # Stub prewarm to avoid background catalog network.
        with patch('server.routes.prewarm'):
            api_records(SimpleNamespace(send=send), svc, {'title': 'Sample', 'artist': 'Artist',
                'location': ' HMV Japan ', 'price': '', 'currency': 'JPY'})
        self.shops.executor.shutdown(wait=True)
        records = self.store.state()['records']
        self.assertEqual(records[0]['location'], 'HMV Japan')
        index = self.shops.index()
        self.assertEqual(index[normalize('HMV Japan')]['status'], 'found')
        self.assertEqual(index[normalize('HMV Japan')]['domain'], 'hmv.co.jp')
        self.assertEqual(self.infer.call_count, 1)
        self.assertEqual(self.shops.icon(index[normalize('HMV Japan')]['icon'].split('/')[-1]), PNG)
        self.assertFalse(self.shops.schedule('HMV Japan'))
        self.assertEqual(self.infer.call_count, 1)

    def test_ambiguous_shop_does_not_fetch_unrelated_icon(self):
        self.infer.return_value = ''
        self.assertTrue(self.shops.schedule('示例唱片行·A 店'))
        self.shops.executor.shutdown(wait=True)
        self.assertEqual(self.shops.index()[normalize('示例唱片行·A 店')]['status'], 'no-icon')
        self.fetch.assert_not_called()

    def test_provider_failure_does_not_break_shop_save(self):
        self.infer.side_effect = RuntimeError('usage limit')
        with patch('server.routes.prewarm'):
            api_records(SimpleNamespace(send=Mock()), SimpleNamespace(store=self.store,
                shops=self.shops, artists=None), {'title': 'Sample', 'artist': 'Artist', 'location': 'Some Shop'})
        self.shops.executor.shutdown(wait=True)
        self.assertEqual(self.store.state()['records'][0]['location'], 'Some Shop')
        self.assertEqual(self.shops.index()['someshop']['status'], 'unavailable')

    def test_existing_channel_skips_model_call(self):
        self.store.save({'title': 'Saved Album', 'artist': 'Artist', 'location': 'Old Store'})
        with patch('server.routes.prewarm'):
            api_records(SimpleNamespace(send=Mock()), SimpleNamespace(store=self.store,
                shops=self.shops), {'title': 'Second', 'artist': 'Artist', 'location': 'Old Store'})
        self.shops.executor.shutdown(wait=True)
        self.infer.assert_not_called()

    @patch('server.shop_brands.pi_environment', return_value={'PATH': '/fake'})
    @patch('server.shop_brands.pi_binary', return_value='/fake/pi')
    @patch('server.shop_brands.subprocess.run')
    def test_pi_cli_sandbox_and_official_domain_validation(self, run, binary, env):
        run.return_value = SimpleNamespace(returncode=0,
            stdout='{"domain":"hmv.co.jp","confidence":"high"}', stderr='')
        self.assertEqual(infer_domain('HMV Japan', model='gpt-5.5'), 'hmv.co.jp')
        args = run.call_args.args[0]
        for flag in ('--no-tools', '--no-extensions', '--no-context-files', '--no-session'):
            self.assertIn(flag, args)
        self.assertEqual(run.call_args.kwargs['cwd'], '/tmp')
        run.return_value.stdout = '{"domain":"127.0.0.1","confidence":"high"}'
        self.assertEqual(infer_domain('Questionable'), '')
        run.return_value.stdout = '{"domain":"hmv.co.jp","confidence":"low"}'
        self.assertEqual(infer_domain('Questionable'), '')


if __name__ == '__main__':
    unittest.main()
