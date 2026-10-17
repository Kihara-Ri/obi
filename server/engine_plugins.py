"""Verified local Album Engine installation and per-instance lazy runtime lifecycle.

Only the official shipped catalog is executable input. User assets are owned by
Store and live outside the installation tree. Nothing imports a runtime until
an installed engine is explicitly used.
"""
from contextlib import contextmanager
import fcntl
import hashlib
import importlib.util
import importlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import sys
import tempfile
import threading
from uuid import uuid4
import zipfile
from domain import ValidationError, ConflictError
from server.catalog_art import ArtClient

VERSION = re.compile(r'^[0-9]+\.[0-9]+\.[0-9]+$')
DIGEST = re.compile(r'^[0-9a-f]{64}$')
PREFIX = '/api/plugins/album-engine/assets/'


def safe_name(value):
    if not isinstance(value, str) or not value or '\\' in value or any(ord(char) < 32 for char in value) or re.match(r'^[A-Za-z]:', value): return False
    path = PurePosixPath(value)
    return not path.is_absolute() and all(p not in ('', '.', '..') for p in value.split('/'))


def validate_manifest(value):
    if not isinstance(value, dict) or value.get('id') != 'album-engine' or (type(value.get('pluginProtocol')) is not int or value.get('pluginProtocol') != 1):
        raise ValidationError('Album Engine 插件协议不兼容')
    if not isinstance(value.get('version'), str) or not VERSION.fullmatch(value['version']):
        raise ValidationError('Album Engine 版本无效')
    if value.get('schemaVersion') != 2 or (type(value.get('rigVersion')) is not int or value.get('rigVersion') != 1) or value.get('modelSet') != 'album-rig-1':
        raise ValidationError('Album Engine 模型或文档协议不兼容')
    for key, expected in {'browserEntry':'browser/plugin.js', 'style':'browser/style.css', 'runtime':'runtime/album_engine', 'models':'models/packaging'}.items():
        if value.get(key) != expected: raise ValidationError('Album Engine 插件入口无效')
    hashes = value.get('sha256')
    if not isinstance(hashes, dict) or not hashes or any(not safe_name(k) or not isinstance(v,str) or not DIGEST.fullmatch(v) for k,v in hashes.items()):
        raise ValidationError('Album Engine 文件校验清单无效')
    required = [value['browserEntry'], value['style'], value['runtime'] + '/__init__.py', value['runtime'] + '/worker.py', value['runtime'] + '/runtime-manifest.json', value['models'] + '/manifest.json']
    if any(name not in hashes for name in required): raise ValidationError('Album Engine 插件文件不完整')
    return value


def validate_contract_files(root, manifest):
    runtime = json.loads((root / manifest['runtime'] / 'runtime-manifest.json').read_text())
    if not isinstance(runtime, dict) or any(runtime.get(key) != manifest[key] for key in ('version','modelSet','schemaVersion','rigVersion')):
        raise ValidationError('Album Engine 运行库与插件版本不匹配')
    models = json.loads((root / manifest['models'] / 'manifest.json').read_text())
    if not isinstance(models, dict) or models.get('rigVersion') != manifest['rigVersion'] or not isinstance(models.get('models'), dict) or not models['models']:
        raise ValidationError('Album Engine 模型与插件协议不匹配')
    for name in models['models']:
        if not safe_name(name) or '/' in name or manifest['models'] + '/' + name + '.glb' not in manifest['sha256']:
            raise ValidationError('Album Engine 模型文件不完整')


class RuntimeFacade:
    def __init__(self, manager):
        self.manager = manager
        self.art = ArtClient()
        self.wake = threading.Event()

    def index(self):
        return self.manager.store.twin_index() | {'configured':bool(self.manager.vision.public_config().get('configured')), 'skill':self.manager.status().get('version') or ''}

    def start(self): self.manager.start()
    def stop(self): self.manager.stop()
    def cancel(self, ident):
        with self.manager.locked(): return self.manager.store.cancel_twin(ident)

    def __getattr__(self, name):
        def call(*args, **kwargs):
            with self.manager.locked():
                service = self.manager.service()
                try: return getattr(service, name)(*args, **kwargs)
                except service._host_errors.ConflictError as exc: raise ConflictError(str(exc)) from None
                except service._host_errors.ValidationError as exc: raise ValidationError(str(exc)) from None
        return call


class PluginManager:
    def __init__(self, store, vision, mb, catalog_dir=None):
        self.store, self.vision, self.mb = store, vision, mb
        self.catalog_dir = Path(catalog_dir or Path(__file__).resolve().parents[1] / 'plugins/album-engine')
        self.folder = store.path.parent / 'plugins/album-engine'
        self._lock = threading.RLock()
        self._runtime = None
        self._namespace = None
        self._started = False
        self._lifecycle_handle = None
        self._error = ''
        self.facade = RuntimeFacade(self)
        self.store.model_snapshot_provider = self.model_snapshot

    @contextmanager
    def locked(self):
        with self._lock:
            self.folder.parent.mkdir(parents=True, exist_ok=True)
            with (self.folder.parent / '.album-engine.lock').open('a+b') as handle:
                fcntl.flock(handle, fcntl.LOCK_EX)
                try: yield
                finally: fcntl.flock(handle, fcntl.LOCK_UN)

    def _catalog(self):
        try:
            data = json.loads((self.catalog_dir / 'catalog.json').read_text())
            item = data.get('album-engine', data)
            if isinstance(item.get('versions'), list): item = item['versions'][-1]
            version = item.get('version') or item.get('availableVersion')
            package = item.get('file') or item.get('archive') or f'album-engine-plugin-{version}.zip'
            digest = item.get('sha256')
            if not isinstance(version,str) or not VERSION.fullmatch(version) or not safe_name(package) or '/' in package or not isinstance(digest,str) or not DIGEST.fullmatch(digest): raise ValueError()
            path = self.catalog_dir / package
            if not path.is_file(): raise ValueError()
            return version, path, digest
        except (OSError, ValueError, TypeError, AttributeError):
            return None

    def _installed(self, state=None):
        state = state or self.store.plugin_state()
        version = state.get('version')
        if not version: return None
        if not isinstance(version,str) or not VERSION.fullmatch(version): raise ValidationError('已安装插件版本无效')
        root = self.folder / version
        try:
            if root.is_symlink(): raise ValueError('symlink')
            manifest = validate_manifest(json.loads((root / 'manifest.json').read_text()))
            if manifest['version'] != version: raise ValueError('version')
            for name, digest in manifest['sha256'].items():
                path = root / name
                if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()) or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest: raise ValueError('checksum')
            validate_contract_files(root, manifest)
            return root, manifest
        except (OSError, ValueError, TypeError): raise ValidationError('已安装 Album Engine 文件损坏，请重新安装') from None

    def status(self):
        state = self.store.plugin_state()
        catalog = self._catalog()
        installed = None
        error = self._error
        try: installed = self._installed(state)
        except ValidationError as exc: error = str(exc)
        manifest = installed[1] if installed else {}
        return {'installed':bool(installed), 'available':bool(catalog), 'version':manifest.get('version'),
                'availableVersion':catalog[0] if catalog else None, 'revision':state['revision'],
                'entryUrl':PREFIX + manifest['version'] + '/' + manifest['browserEntry'] if installed else None,
                'styleUrl':PREFIX + manifest['version'] + '/' + manifest['style'] if installed else None,
                'modelBaseUrl':PREFIX + manifest['version'] + '/' + manifest['models'] + '/' if installed else None,
                'busy':self.store.twin_busy(), 'error':error or None}

    def _extract(self, archive, stage):
        try:
            with zipfile.ZipFile(archive) as bundle:
                entries = bundle.infolist()
                names = [entry.filename for entry in entries]
                if len(names) != len(set(names)) or len(names) > 10000: raise ValueError('duplicate')
                if sum(item.file_size for item in entries) > 512 * 1024 * 1024: raise ValueError('size')
                for item in entries:
                    name = item.filename.rstrip('/')
                    mode = item.external_attr >> 16
                    if not safe_name(name) or stat.S_ISLNK(mode) or (stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR)):
                        raise ValueError('path')
                manifest = validate_manifest(json.loads(bundle.read('manifest.json')))
                files = {e.filename for e in entries if not e.is_dir()}
                if files != set(manifest['sha256']) | {'manifest.json'}: raise ValueError('manifest')
                for name in files:
                    raw = bundle.read(name)
                    if name != 'manifest.json' and hashlib.sha256(raw).hexdigest() != manifest['sha256'][name]: raise ValueError('checksum')
                    target = stage / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(raw)
                validate_contract_files(stage, manifest)
                return manifest
        except (zipfile.BadZipFile, KeyError, OSError, ValueError, TypeError):
            raise ValidationError('Album Engine 安装包校验失败') from None

    def install(self, expected_revision=None):
        with self.locked():
            state = self.store.plugin_state()
            self.store.check_plugin_revision(state, expected_revision)
            catalog = self._catalog()
            if not catalog: raise ValidationError('没有可安装的 Album Engine 软件包')
            version, archive, digest = catalog
            if hashlib.sha256(archive.read_bytes()).hexdigest() != digest: raise ValidationError('Album Engine 安装包校验失败')
            if state.get('version') == version:
                try:
                    if self._installed(state): return self.status()
                except ValidationError: pass
            if self.store.twin_busy(): raise ConflictError('数字实体任务正在排队或生成，请等待完成后再更改插件')
            if state.get('version') and state['version'] != version:
                self.pin_published_models()
            self.folder.mkdir(parents=True, exist_ok=True)
            stage = Path(tempfile.mkdtemp(prefix='.staging-', dir=self.folder))
            target = self.folder / version
            previous = None
            try:
                manifest = self._extract(archive, stage)
                if manifest['version'] != version: raise ValidationError('Album Engine 软件包版本与目录不匹配')
                base = manifest['models'] + '/'
                self.store.pin_published_twin_models({'version':version, 'modelSet':manifest['modelSet'],
                    'files':{name[len(base):]:stage / name for name in manifest['sha256'] if name.startswith(base)}})
                if target.exists():
                    previous = self.folder / ('.previous-' + uuid4().hex)
                    target.replace(previous)
                stage.replace(target)
                try: self.store.change_plugin_state(version, expected_revision=state['revision'])
                except Exception:
                    shutil.rmtree(target)
                    if previous: previous.replace(target)
                    raise
                self._unload()
                self._error = ''
                if previous: shutil.rmtree(previous)
            finally:
                if stage.exists(): shutil.rmtree(stage)
            return self.status()

    def uninstall(self, expected_revision=None):
        with self.locked():
            state = self.store.plugin_state()
            self.store.check_plugin_revision(state, expected_revision)
            if self.store.twin_busy(): raise ConflictError('数字实体任务正在排队或生成，请等待完成后再卸载')
            if not state.get('version'): return self.status()
            try: self.pin_published_models()
            except ValidationError:
                # A broken executable installation may be removed once every
                # published job already owns its durable model snapshot.
                if not self.store.published_twins_have_models(): raise
            self._unload()
            self.store.change_plugin_state(None, expected_revision=state['revision'])
            # This directory contains executable package files only. Entity and
            # model assets are owned by Store in sibling user-data directories.
            if self.folder.exists(): shutil.rmtree(self.folder)
            self._error = ''
            return self.status()

    def model_snapshot(self):
        installed = self._installed()
        if not installed: raise ValidationError('请先安装 Album Engine')
        root, manifest = installed
        base = manifest['models'] + '/'
        return {'version':manifest['version'], 'modelSet':manifest['modelSet'],
                'files':{name[len(base):]:root / name for name in manifest['sha256'] if name.startswith(base)}}

    def pin_published_models(self):
        if not self._installed(): return
        snapshot = self.model_snapshot()
        self.store.pin_published_twin_models(snapshot)

    def asset(self, name, version=None):
        if not safe_name(name): raise ValidationError('插件资源地址无效')
        installed = self._installed()
        if not installed: raise ValidationError('Album Engine 尚未安装')
        root, manifest = installed
        if version is not None and version != manifest['version']:
            raise ValidationError('插件版本已变化，请刷新页面')
        # Python and installation metadata are never exposed over HTTP.
        if name not in manifest['sha256'] or not (name.startswith('browser/') or name.startswith(manifest['models'] + '/')):
            raise ValidationError('插件资源不存在')
        return root / name

    def service(self):
        installed = self._installed()
        if not installed: raise ValidationError('请先在设置中安装 Album Engine')
        if self._runtime is not None: return self._runtime
        root, manifest = installed
        namespace = '_diedu_album_engine_' + uuid4().hex
        try:
            source = root / manifest['runtime']
            spec = importlib.util.spec_from_file_location(namespace, source / '__init__.py', submodule_search_locations=[str(source)])
            module = importlib.util.module_from_spec(spec)
            sys.modules[namespace] = module
            spec.loader.exec_module(module)
            worker = importlib.import_module(namespace + '.worker')
            errors = importlib.import_module(namespace + '.errors')
            from server.album_engine_adapter import TaskAdapter, VisionAdapter, CatalogAdapter
            runtime = worker.DigitalTwinService(TaskAdapter(self.store, errors=errors), VisionAdapter(self.vision, errors=errors), CatalogAdapter(self.mb, errors=errors))
            runtime._host_errors = errors
            self._runtime, self._namespace = runtime, namespace
            if (source / 'guided.py').is_file():
                guided = importlib.import_module(namespace + '.guided')
                def validated_mapping(*args):
                    try: return guided.validated_mapping(*args)
                    except errors.ValidationError as exc: raise ValidationError(str(exc)) from None
                self.store.guided_selection_helpers = (guided.candidate_images, validated_mapping)
            self.facade.wake = runtime.wake
            if self._started: runtime.start()
            return runtime
        except Exception as exc:
            self._runtime = None
            self._namespace = None
            self.store.guided_selection_helpers = None
            for key in list(sys.modules):
                if key == namespace or key.startswith(namespace + '.'): sys.modules.pop(key, None)
            self._error = 'Album Engine 运行库无法载入，请重新安装'
            raise ValidationError(self._error) from exc

    def start(self):
        if self._started: return
        with self.locked():
            handle = (self.folder.parent / '.album-engine-owner.lock').open('a+b')
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                # Another live application owns recovery for this data folder.
                handle.close()
            else:
                try: self.store.interrupt_twin_tasks_on_startup()
                except Exception:
                    handle.close()
                    raise
                self._lifecycle_handle = handle
            self._started = True
        # Starting the host never imports or starts generation implicitly.

    def _unload(self):
        if self._runtime is not None: self._runtime.stop()
        self._runtime = None
        self.store.guided_selection_helpers = None
        if self._namespace:
            for key in list(sys.modules):
                if key == self._namespace or key.startswith(self._namespace + '.'): sys.modules.pop(key, None)
        self._namespace = None

    def stop(self):
        self._started = False
        try: self._unload()
        finally:
            if self._lifecycle_handle is not None:
                self._lifecycle_handle.close()
                self._lifecycle_handle = None
