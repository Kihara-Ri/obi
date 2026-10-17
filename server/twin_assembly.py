"""Compatibility adapter for engine-owned assembly."""
from vendor.album_engine.assembly import GeometryAssembly as _Engine, rows_match_manual_region
from server.album_engine_adapter import host_type
GeometryAssembly = host_type(_Engine)
