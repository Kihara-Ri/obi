"""Host wiring for the independently packaged Album Engine generation worker."""
from vendor.album_engine import errors as engine_errors
from domain import ValidationError, ConflictError
from vendor.album_engine.worker import DigitalTwinService as EngineDigitalTwinService
from server.album_engine_adapter import TaskAdapter, CatalogAdapter, VisionAdapter, host_type
from server.twin_sources import ArtClient, DiscogsClient, ArtRedirect, DiscogsRedirect, discogs_image_url, SourceDiscovery
from server.twin_surfaces import SurfaceUnderstanding
from server.twin_assembly import GeometryAssembly, rows_match_manual_region
from server.twin_errors import NeedsInput, Stopped, ArtNotFound

class _SourceAdapter:
    """Translate legacy injected transports into the packaged runtime's errors."""
    def __init__(self, source): self.source = source
    def __getattr__(self, name):
        value = getattr(self.source, name)
        if not callable(value): return value
        def call(*args, **kwargs):
            try: return value(*args, **kwargs)
            except ConflictError as exc: raise engine_errors.ConflictError(str(exc)) from None
            except ValidationError as exc:
                if isinstance(exc, engine_errors.ValidationError): raise
                raise engine_errors.ValidationError(str(exc)) from None
        return call


class DigitalTwinService(host_type(EngineDigitalTwinService)):
    # Legacy test/tool injections may replace transports after construction.
    # Production uses PluginManager's isolated runtime and explicit capabilities.
    def __setattr__(self, name, value):
        if name in ('art', 'discogs') and not isinstance(value, _SourceAdapter):
            value = _SourceAdapter(value)
        super().__setattr__(name, value)
    def __init__(self, store, vision, mb, art=None, discogs=None):
        super().__init__(TaskAdapter(store, errors=engine_errors), VisionAdapter(vision, errors=engine_errors), CatalogAdapter(mb, errors=engine_errors), art or ArtClient(), discogs or DiscogsClient())
