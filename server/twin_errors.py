"""Compatibility exception names for the engine-owned generation runtime."""
from domain import ValidationError
from vendor.album_engine.errors import NeedsInput, Stopped
from vendor.album_engine.errors import ArtNotFound as EngineArtNotFound

class ArtNotFound(ValidationError, EngineArtNotFound): pass
