"""Host wiring for the independently packaged Album Engine generation worker."""
from vendor.album_engine.worker import DigitalTwinService as EngineDigitalTwinService
from server.album_engine_adapter import TaskAdapter, CatalogAdapter, VisionAdapter, host_type
from server.twin_sources import ArtClient, DiscogsClient, ArtRedirect, DiscogsRedirect, discogs_image_url, SourceDiscovery
from server.twin_surfaces import SurfaceUnderstanding
from server.twin_assembly import GeometryAssembly, rows_match_manual_region
from server.twin_errors import NeedsInput, Stopped, ArtNotFound

class DigitalTwinService(host_type(EngineDigitalTwinService)):
    def __init__(self, store, vision, mb, art=None, discogs=None):
        super().__init__(TaskAdapter(store), VisionAdapter(vision), CatalogAdapter(mb), art or ArtClient(), discogs or DiscogsClient())
