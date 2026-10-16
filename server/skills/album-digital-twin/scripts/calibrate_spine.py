#!/usr/bin/env python3
"""Compatibility entrypoint; implementation is packaged by Album Engine."""
from pathlib import Path
_source = Path(__file__).resolve().parents[4] / 'vendor/album_engine/skill/scripts/calibrate_spine.py'
exec(compile(_source.read_bytes(), str(_source), 'exec'), globals())
