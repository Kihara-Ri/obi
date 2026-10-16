"""Host exception and persistence adapters for the independently packaged engine.

The engine receives capabilities, never a Store, connection, transaction, or
host domain module. Only storage.py can commit task or entity state.
"""
from contextlib import closing
from copy import deepcopy
from functools import wraps
from domain import ValidationError, ConflictError
from musicbrainz import SourceUnavailable, BadSource
from vendor.album_engine import errors


def check_engine_installation(root):
    """Called during service assembly, never at import or against user data."""
    import json
    from pathlib import Path
    root = Path(root)
    try:
        runtime = json.loads((root / 'vendor/album_engine/runtime-manifest.json').read_text())
        viewer = json.loads((root / 'static/models/packaging/engine-manifest.json').read_text())
        if any(runtime.get(key) != viewer.get(key) for key in ('version','modelSet','schemaVersion','rigVersion')):
            raise ValueError('version mismatch')
        if not isinstance(runtime.get('version'), str) or not runtime['version'] or runtime.get('schemaVersion') != 2 or runtime.get('rigVersion') != 1 or runtime.get('modelSet') != 'album-rig-1':
            raise ValueError('unsupported protocol')
    except (OSError, ValueError, TypeError) as exc:
        raise RuntimeError('Album Engine 查看器、模型与生成运行库版本不匹配，请重新构建完整应用') from exc
    return viewer


def host_call(function):
    @wraps(function)
    def invoke(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except (ValidationError, ConflictError):
            raise
        except errors.ArtNotFound as exc:
            from server.twin_errors import ArtNotFound
            raise ArtNotFound(str(exc)) from None
        except errors.ConflictError as exc:
            raise ConflictError(str(exc)) from None
        except errors.ValidationError as exc:
            raise ValidationError(str(exc)) from None
    return invoke


def host_type(engine_type):
    """Preserve historical import/class API while translating engine failures."""
    namespace = {'__module__':engine_type.__module__, '__doc__':engine_type.__doc__}
    for name, value in engine_type.__dict__.items():
        if name.startswith('__') and name != '__init__': continue
        if isinstance(value, staticmethod): namespace[name] = staticmethod(host_call(value.__func__))
        elif isinstance(value, classmethod): namespace[name] = classmethod(host_call(value.__func__))
        elif callable(value): namespace[name] = host_call(value)
    return type(engine_type.__name__,(engine_type,),namespace)


class TaskAdapter:
    """Narrow capabilities backed exclusively by existing Store transactions."""
    def __init__(self, store): self.__store = store
    def task_snapshot(self, ident):
        with closing(self.__store.connect()) as db:
            from twins import TWIN_KEY
            registry = self.__store.meta_get(db,TWIN_KEY) or {}
            # Do not expose other task or unrelated business data.
            job = deepcopy(registry.get('jobs',{}).get(ident))
            latest = {job['recordId']:registry.get('latest',{}).get(job['recordId'])} if job else {}
            return {'latest':latest}, job
    def review_asset_url(self, ident, asset): return f'/api/twin-review-assets/{ident}/{asset}'
    def twin_index(self): return self.__store.twin_index()
    def start_twin(self, body): return self.__store.start_twin(body)
    def claim_twin(self, owner): return self.__store.claim_twin(owner)
    def heartbeat_twin(self, ident, claim): return self.__store.heartbeat_twin(ident,claim)
    def update_twin(self, ident, claim, **patch): return self.__store.update_twin(ident,claim,**patch)
    def cancel_twin(self, ident): return self.__store.cancel_twin(ident)
    def set_twin_accessories(self, ident, selected, downloaded): return self.__store.set_twin_accessories(ident,selected,downloaded)
    def twin_source(self, ident, asset): return self.__store.twin_source(ident,asset)
    def write_twin_source(self, ident, claim, asset, raw): return self.__store.write_twin_source(ident,claim,asset,raw)


class VisionAdapter:
    """Expose only configured state and the JSON operation, never host services."""
    __slots__ = ('__public_config', '__agent_json')

    def __init__(self, service):
        self.__public_config = lambda: service.public_config()
        self.__agent_json = lambda *args, **kwargs: service.agent_json(*args, **kwargs)

    def public_config(self):
        return {'configured':bool(self.__public_config().get('configured'))}

    def agent_json(self, system, prompt, images=(), on_start=None):
        return self.__agent_json(system, prompt, images, on_start=on_start)


class CatalogAdapter:
    """Reuse the application's shared MusicBrainz client and its existing throttle."""
    def __init__(self, client): self.__client = client
    @property
    def calls(self):
        # Historical service diagnostics; no extra catalog capability is passed.
        return self.__client.calls
    def get(self, path, params):
        try: return self.__client.get(path,params)
        except SourceUnavailable as exc: raise errors.SourceUnavailable(str(exc)) from None
        except BadSource as exc: raise errors.BadSource(str(exc)) from None


from vendor.album_engine import compile_document as _compile, validate_document as _validate, prepare_publication as _publish
compile_document = host_call(_compile)
validate_document = host_call(_validate)
prepare_publication = host_call(_publish)
