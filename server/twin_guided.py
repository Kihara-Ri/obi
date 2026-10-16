"""Compatibility names; guided selection/assembly is owned by Album Engine."""
from vendor.album_engine.guided import ROLES, KINDS, candidate_images, suggested_surfaces
from vendor.album_engine.guided import validated_mapping as _mapping, generate_guided as _generate
from server.album_engine_adapter import host_call
validated_mapping = host_call(_mapping)
generate_guided = host_call(_generate)
