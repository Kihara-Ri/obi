"""Framework installation checks; no ledger or personal data."""
import hashlib
import json
import shutil
import tempfile
import unittest
import zipfile
from pathlib import Path

from server.album_engine_adapter import check_engine_installation

ROOT = Path(__file__).resolve().parents[1]


class DistributionTests(unittest.TestCase):
    def test_mismatched_plugin_and_data_codec_cannot_start_as_one_engine(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(ROOT / 'vendor/album_data', root / 'vendor/album_data')
            codec = json.loads((root / 'vendor/album_data/data-codec-manifest.json').read_text())
            def ship(version):
                folder = root / 'plugins/album-engine'; folder.mkdir(parents=True, exist_ok=True)
                runtime = {key: codec[key] for key in ('modelSet', 'schemaVersion', 'rigVersion')} | {'version': version}
                archive = folder / 'album-engine-plugin.zip'
                with zipfile.ZipFile(archive, 'w') as bundle:
                    bundle.writestr('manifest.json', json.dumps(runtime))
                    bundle.writestr('runtime/album_engine/runtime-manifest.json', json.dumps(runtime))
                (folder / 'catalog.json').write_text(json.dumps({'file': archive.name,
                    'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}))
            ship(codec['version'])
            self.assertEqual(check_engine_installation(root)['version'], codec['version'])
            ship('0.1.10')
            with self.assertRaisesRegex(RuntimeError, 'Album Engine'):
                check_engine_installation(root)
            (root / 'plugins/album-engine/catalog.json').unlink()
            with self.assertRaisesRegex(RuntimeError, 'Album Engine'):
                check_engine_installation(root)

    def test_current_built_installation_is_matched(self):
        self.assertEqual(check_engine_installation(ROOT)['modelSet'], 'album-rig-1')
