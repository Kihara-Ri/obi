"""Compatibility adapter; all discovery and artwork rules live in Album Engine."""
from urllib.request import build_opener
from vendor.album_engine import sources as _engine
from server.album_engine_adapter import host_type, host_call

ArtRedirect = host_type(_engine.ArtRedirect)
DiscogsRedirect = host_type(_engine.DiscogsRedirect)
SourceDiscovery = host_type(_engine.SourceDiscovery)
SourceManifest = _engine.SourceManifest
discogs_image_url = host_call(_engine.discogs_image_url)

class ArtClient(host_type(_engine.ArtClient)):
    def __init__(self): super().__init__(opener_factory=lambda *args: build_opener(*args))

class DiscogsClient(host_type(_engine.DiscogsClient)):
    def __init__(self): super().__init__(opener_factory=lambda *args: build_opener(*args))
