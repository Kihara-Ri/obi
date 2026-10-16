"""Host task compatibility and appearance identity; entity rules belong to Album Engine."""
from vendor.album_engine import contracts as _engine
from functools import wraps
from domain import ValidationError
from vendor.album_engine.errors import ValidationError as EngineValidationError


def host_call(function):
    @wraps(function)
    def invoke(*args, **kwargs):
        try: return function(*args, **kwargs)
        except ValidationError: raise
        except EngineValidationError as exc: raise ValidationError(str(exc)) from None
    return invoke


TWIN_KEY = _engine.TWIN_KEY
SKILL_VERSION = _engine.SKILL_VERSION
JOB_STATES = _engine.JOB_STATES
ID = _engine.ID
ASSET = _engine.ASSET
UUID = _engine.UUID
ACCESSORY_KINDS = _engine.ACCESSORY_KINDS
clean_barcode = host_call(_engine.clean_barcode)
release_id = host_call(_engine.release_id)
image_type = host_call(_engine.image_type)
clean_warp_rows = host_call(_engine.clean_warp_rows)
clean_spine_calibration = host_call(_engine.clean_spine_calibration)
clean_spine_binding = host_call(_engine.clean_spine_binding)
clean_disc_calibration = host_call(_engine.clean_disc_calibration)
clean_accessories = host_call(_engine.clean_accessories)
entity_assets = _engine.entity_assets
clean_entity = host_call(_engine.clean_entity)
clean_registry = host_call(_engine.clean_registry)


def appearance(record):
    keys = ('title', 'artist', 'version', 'pressing', 'obi', 'packaging', 'cover', 'photoCount', 'photoRevision')
    result = {key: record.get(key) for key in keys}
    result['releaseInfo'] = {key: record.get('releaseInfo', {}).get(key, '') for key in
                            ('barcode', 'catalogNumber', 'country', 'edition', 'packaging', 'label', 'releaseDate', 'discCount', 'format', 'matrix', 'musicBrainzReleaseId')}
    return result


def same_appearance(record, snapshot):
    # Tasks created before the release-UUID field was added have no such key
    # in their persisted appearance snapshot. Missing means "not confirmed",
    # not "appearance changed". Preserve old published entities without
    # rewriting the snapshot or touching their source assets.
    if not isinstance(snapshot, dict):
        return False
    current = appearance(record)
    old_release = snapshot.get('releaseInfo')
    if isinstance(old_release, dict) and 'packaging' not in old_release and not current['releaseInfo']['packaging']:
        # The packaging source was added after older 3D jobs were published.
        current['releaseInfo'].pop('packaging')
    if isinstance(old_release, dict) and 'musicBrainzReleaseId' not in old_release:
        if current['releaseInfo']['musicBrainzReleaseId']:
            return False  # A newly confirmed edition *is* a material change.
        current['releaseInfo'].pop('musicBrainzReleaseId')
    return current == snapshot
