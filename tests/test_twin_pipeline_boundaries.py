"""Host adapters preserve imports and translate engine validation failures."""
import unittest

from domain import ValidationError
from server.twin_sources import SourceDiscovery, SourceManifest
from server.twin_surfaces import SurfaceUnderstanding
from server.twin_assembly import GeometryAssembly
from server.twin_errors import NeedsInput
from vendor.album_engine import errors
from vendor.album_engine.assembly import GeometryAssembly as EngineAssembly
from vendor.album_engine.sources import SourceDiscovery as EngineDiscovery, SourceManifest as EngineManifest
from vendor.album_engine.surfaces import SurfaceUnderstanding as EngineUnderstanding


class PipelineCompatibilityTests(unittest.TestCase):
    def test_adapters_preserve_entrypoints_and_translate_engine_validation(self):
        self.assertIs(SourceManifest, EngineManifest)
        self.assertIs(NeedsInput, errors.NeedsInput)
        for adapter, engine, method in [(SourceDiscovery, EngineDiscovery, 'fetch_images'),
                                        (SurfaceUnderstanding, EngineUnderstanding, 'plan'),
                                        (GeometryAssembly, EngineAssembly, 'assemble')]:
            with self.subTest(adapter=adapter.__name__):
                self.assertTrue(issubclass(adapter, engine))
                self.assertIs(getattr(adapter, method).__wrapped__, getattr(engine, method))
        evidence = SourceManifest(context={}, sources={}, catalog_ids={}, related_ids={},
                                  reference_ids={}, edition='')
        with self.assertRaisesRegex(ValidationError, '不存在'):
            SourceDiscovery(None, None, None, None).fetch_images(
                {}, evidence, ['unknown-source'], lambda *_: None)


if __name__ == '__main__':
    unittest.main()
