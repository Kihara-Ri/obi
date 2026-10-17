"""Independent runtime failures translated by each host adapter."""
class ValidationError(ValueError): pass
class ConflictError(ValidationError): pass
class SourceUnavailable(Exception): pass
class BadSource(Exception): pass
class NeedsInput(Exception):
    def __init__(self, message, phase='needs_material'):
        super().__init__(message); self.phase = phase
class Stopped(Exception): pass
class ArtNotFound(ValidationError): pass
