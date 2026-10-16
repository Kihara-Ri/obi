"""Compatibility adapter for engine-owned source interpretation."""
from vendor.album_engine.surfaces import SurfaceUnderstanding as _Engine
from server.album_engine_adapter import host_type
SurfaceUnderstanding = host_type(_Engine)
