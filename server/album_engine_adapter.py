"""Host exception and persistence adapters for the independently packaged engine.

The engine receives capabilities, never a Store, connection, transaction, or
host domain module. Only storage.py can commit task or entity state.
"""
from contextlib import closing
from copy import deepcopy
from functools import wraps
from domain import ValidationError, ConflictError
from musicbrainz import SourceUnavailable, BadSource
from vendor.album_data import errors


def check_engine_installation(root):
    """Validate a shipped optional catalog, not a required user installation.

    Legacy artifact layouts remain inspectable by compatibility tools. App
    startup never depends on this development/distribution check.
    """
    import hashlib
    import json
    import zipfile
    from pathlib import Path
    root = Path(root)
    catalog = root / 'plugins/album-engine/catalog.json'
    try:
        if catalog.is_file():
            spec = json.loads(catalog.read_text())
            archive = catalog.parent / spec['file']
            if archive.parent != catalog.parent or hashlib.sha256(archive.read_bytes()).hexdigest() != spec['sha256']:
                raise ValueError('catalog checksum')
            with zipfile.ZipFile(archive) as package:
                viewer = json.loads(package.read('manifest.json'))
                runtime = json.loads(package.read('runtime/album_engine/runtime-manifest.json'))
            codec = json.loads((root / 'vendor/album_data/data-codec-manifest.json').read_text())
            if any(codec.get(key) != viewer.get(key) for key in ('version','modelSet','schemaVersion','rigVersion')):
                raise ValueError('data codec mismatch')
        else:
            runtime = json.loads((root / 'vendor/album_engine/runtime-manifest.json').read_text())
            viewer = json.loads((root / 'static/models/packaging/engine-manifest.json').read_text())
        if any(runtime.get(key) != viewer.get(key) for key in ('version','modelSet','schemaVersion','rigVersion')):
            raise ValueError('version mismatch')
        if not isinstance(runtime.get('version'), str) or not runtime['version'] or runtime.get('schemaVersion') != 2 or runtime.get('rigVersion') != 1 or runtime.get('modelSet') != 'album-rig-1':
            raise ValueError('unsupported protocol')
    except (OSError, ValueError, TypeError, KeyError, zipfile.BadZipFile) as exc:
        raise RuntimeError('Album Engine 插件包与数据协议不匹配，请重新构建完整发行包') from exc
    return viewer


def host_call(function):
    @wraps(function)
    def invoke(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except (ValidationError, ConflictError):
            raise
        except Exception as exc:
            # Runtime packages are isolated namespaces; their exception classes
            # are intentionally not the persistence codec's class identities.
            names = {base.__name__ for base in type(exc).__mro__}
            if type(exc).__module__.endswith('.errors'):
                if 'ArtNotFound' in names:
                    from server.twin_errors import ArtNotFound
                    raise ArtNotFound(str(exc)) from None
                if 'ConflictError' in names: raise ConflictError(str(exc)) from None
                if 'ValidationError' in names: raise ValidationError(str(exc)) from None
            raise
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
    def __init__(self, store, errors=errors):
        self.__store, self.__errors = store, errors
    def _call(self, name, *args, **kwargs):
        try: return getattr(self.__store, name)(*args, **kwargs)
        except ConflictError as exc: raise self.__errors.ConflictError(str(exc)) from None
        except ValidationError as exc: raise self.__errors.ValidationError(str(exc)) from None
    def task_snapshot(self, ident):
        with closing(self.__store.connect()) as db:
            from twins import TWIN_KEY
            registry = self.__store.meta_get(db,TWIN_KEY) or {}
            # Do not expose other task or unrelated business data.
            job = deepcopy(registry.get('jobs',{}).get(ident))
            latest = {job['recordId']:registry.get('latest',{}).get(job['recordId'])} if job else {}
            return {'latest':latest}, job
    def review_asset_url(self, ident, asset): return f'/api/twin-review-assets/{ident}/{asset}'
    def twin_index(self): return self._call('twin_index')
    def start_twin(self, body): return self._call('start_twin', body)
    def claim_twin(self, owner): return self._call('claim_twin', owner)
    def heartbeat_twin(self, ident, claim): return self._call('heartbeat_twin', ident,claim)
    def update_twin(self, ident, claim, **patch): return self._call('update_twin', ident,claim,**patch)
    def cancel_twin(self, ident): return self._call('cancel_twin', ident)
    def set_twin_accessories(self, ident, selected, downloaded): return self._call('set_twin_accessories', ident,selected,downloaded)
    def twin_source(self, ident, asset): return self._call('twin_source', ident,asset)
    def write_twin_source(self, ident, claim, asset, raw): return self._call('write_twin_source', ident,claim,asset,raw)


class VisionAdapter:
    """视觉模型端口。宿主不再提供视觉模型（传 None）：恒为「未配置」，依赖模型的步骤会被拒绝；
    测试或外部接入可传入带 public_config / agent_json 的对象，此时原样转交。"""
    __slots__ = ('__public_config', '__agent_json', '__errors')

    def __init__(self, service=None, errors=errors):
        self.__errors = errors
        self.__public_config = (lambda: service.public_config()) if service is not None else (lambda: {'configured': False})
        self.__agent_json = (lambda *args, **kwargs: service.agent_json(*args, **kwargs)) if service is not None else None

    def public_config(self):
        return {'configured':bool(self.__public_config().get('configured'))}

    def agent_json(self, system, prompt, images=(), on_start=None):
        if self.__agent_json is None:
            raise self.__errors.ValidationError('宿主不再提供视觉模型；数字实体的生成请在 Album Engine 项目中进行')
        try: return self.__agent_json(system, prompt, images, on_start=on_start)
        except ConflictError as exc: raise self.__errors.ConflictError(str(exc)) from None
        except ValidationError as exc: raise self.__errors.ValidationError(str(exc)) from None


class CatalogAdapter:
    """Reuse the application's shared MusicBrainz client and its existing throttle."""
    def __init__(self, client, errors=errors): self.__client, self.__errors = client, errors
    @property
    def calls(self):
        # Historical service diagnostics; no extra catalog capability is passed.
        return self.__client.calls
    def get(self, path, params):
        try: return self.__client.get(path,params)
        except SourceUnavailable as exc: raise self.__errors.SourceUnavailable(str(exc)) from None
        except BadSource as exc: raise self.__errors.BadSource(str(exc)) from None


from vendor.album_data import compile_document as _compile, validate_document as _validate, prepare_publication as _publish
compile_document = host_call(_compile)
validate_document = host_call(_validate)
prepare_publication = host_call(_publish)
