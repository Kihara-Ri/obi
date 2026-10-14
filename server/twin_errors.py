"""Pipeline exceptions; no network or persistence dependency."""
from domain import ValidationError

class NeedsInput(Exception):
    def __init__(self, message, phase='needs_material'):
        super().__init__(message); self.phase = phase


class Stopped(Exception): pass
class ArtNotFound(ValidationError): pass
