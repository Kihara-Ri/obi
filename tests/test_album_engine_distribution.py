"""Framework installation checks; no ledger or personal data."""
import json
import tempfile
import unittest
from pathlib import Path

from server.album_engine_adapter import check_engine_installation


class DistributionTests(unittest.TestCase):
    def test_mismatched_viewer_runtime_cannot_start_as_one_engine(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'vendor/album_engine').mkdir(parents=True)
            (root / 'static/models/packaging').mkdir(parents=True)
            runtime = {'version': '0.2.0', 'modelSet': 'album-rig-1', 'schemaVersion': 2, 'rigVersion': 1}
            viewer = dict(runtime)
            (root / 'vendor/album_engine/runtime-manifest.json').write_text(json.dumps(runtime))
            viewer_path = root / 'static/models/packaging/engine-manifest.json'
            viewer_path.write_text(json.dumps(viewer))
            self.assertEqual(check_engine_installation(root)['version'], '0.2.0')
            viewer['version'] = '0.1.10'
            viewer_path.write_text(json.dumps(viewer))
            with self.assertRaisesRegex(RuntimeError, 'Album Engine'):
                check_engine_installation(root)

    def test_current_built_installation_is_matched(self):
        root = Path(__file__).resolve().parents[1]
        self.assertEqual(check_engine_installation(root)['modelSet'], 'album-rig-1')
