"""Real filesystem/plugin lifecycle tests using the shared fixed album samples.

The tiny executable ZIP is a transport/protocol fixture, not a visual model.
Real Blender assets are exercised by the fixed preview acceptance.
"""
import hashlib
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import stat
import tempfile
import threading
import unittest
from unittest.mock import Mock
import zipfile

from app import build
from domain import ConflictError, ValidationError
from server import make_handler, Services
from server.engine_plugins import PluginManager
from security import Auth
from tools.seed_samples import seed_models, open_store


def package(folder, *, version='0.3.0', protocol=1, extra=None, corrupt=False, runtime_version=None):
    folder.mkdir(parents=True, exist_ok=True)
    files = {
        'browser/plugin.js':b'export const manifest = {version:"0.3.0"};',
        'browser/style.css':b'.test { color: inherit; }',
        'models/packaging/jewel-case.glb':('protocol-test-model-bytes-not-visual-proof-' + version).encode(),
        'runtime/album_engine/__init__.py':b'',
        'runtime/album_engine/runtime-manifest.json':json.dumps({'version':runtime_version or version,'modelSet':'album-rig-1','schemaVersion':2,'rigVersion':1}).encode(),
        'models/packaging/manifest.json':json.dumps({'rigVersion':1,'models':{'jewel-case':{}}}).encode(),
        'runtime/album_engine/errors.py':b'class ValidationError(Exception): pass\nclass ConflictError(Exception): pass\n',
        'runtime/album_engine/worker.py':b'import threading\nfrom .errors import ValidationError\nclass DigitalTwinService:\n def __init__(self,store,vision,mb): self.store=store; self.wake=threading.Event(); self.thread=None\n def start(self): pass\n def stop(self): pass\n def start_task(self,body): return self.store.start_twin(body)\n def invalid(self): raise ValidationError("fixture-invalid")\n',
    }
    manifest = {'id':'album-engine','pluginProtocol':protocol,'version':version,
                'modelSet':'album-rig-1','schemaVersion':2,'rigVersion':1,
                'browserEntry':'browser/plugin.js','style':'browser/style.css',
                'runtime':'runtime/album_engine','models':'models/packaging',
                'sha256':{name:hashlib.sha256(raw).hexdigest() for name, raw in files.items()}}
    if corrupt: files['browser/plugin.js'] = b'corrupted'
    archive = folder / f'album-engine-plugin-{version}.zip'
    with zipfile.ZipFile(archive, 'w') as bundle:
        bundle.writestr('manifest.json', json.dumps(manifest))
        for name, raw in files.items(): bundle.writestr(name, raw)
        if extra:
            name, raw, mode = extra
            info = zipfile.ZipInfo(name)
            if mode: info.external_attr = mode << 16
            bundle.writestr(info, raw)
    (folder / 'catalog.json').write_text(json.dumps({'version':version,'file':archive.name,
        'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
    return archive


class EnginePluginTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.ids = seed_models(self.root / 'user')
        self.store = open_store(self.root / 'user')
        self.catalog = self.root / 'catalog'
        package(self.catalog)
        self.vision = Mock()
        self.vision.public_config.return_value = {'configured':False}
        self.manager = PluginManager(self.store, self.vision, Mock(), self.catalog)
        self.addCleanup(self.manager.stop)

    def queue_fixed_copy(self, key):
        from storage import uid
        record = next(r for r in self.store.state()['records'] if r['id'] == self.ids[key])
        previous = self.store.twin_index()['jobs'][record['id']]['id']
        self.store.save({'id':record['id'],'revision':record['revision'],'title':record['title'] + ' (corrected)'})
        record = next(r for r in self.store.state()['records'] if r['id'] == record['id'])
        return self.store.start_twin({'recordId':record['id'],'recordRevision':record['revision'],
            'requestId':uid(),'expectedJobId':previous})['job']

    def test_model_pin_increments_public_job_sequence_and_registry_revision(self):
        before = self.store.twin_index()
        self.manager.install()
        after = self.store.twin_index()
        self.assertGreater(after['revision'],before['revision'])
        for rid,job in after['jobs'].items():
            self.assertGreater(job['seq'],before['jobs'][rid]['seq'])
            self.assertIsNotNone(job['models'])
            self.assertEqual(job['entity'],before['jobs'][rid]['entity'])
        self.manager.install()
        self.assertEqual(self.store.twin_index(),after)

    def test_startup_interrupts_old_queued_and_running_claims_without_loading_runtime(self):
        self.manager.install()
        running = self.queue_fixed_copy('illinois')
        claim = self.store.claim_twin('stopped-previous-process')
        self.assertEqual(claim['id'],running['id'])
        queued = self.queue_fixed_copy('loveless')
        before = self.store.twin_index()
        restarted = PluginManager(self.store,self.vision,Mock(),self.catalog)
        self.addCleanup(restarted.stop)
        restarted.start()
        self.assertIsNone(restarted._runtime)
        after = self.store.twin_index()
        for key in ('illinois','loveless'):
            job = after['jobs'][self.ids[key]]
            self.assertEqual(job['status'],'interrupted')
            self.assertGreater(job['seq'],before['jobs'][self.ids[key]]['seq'])
            self.assertIn('手动重试',job['error'])
        self.assertFalse(self.store.heartbeat_twin(running['id'],claim['claim']))
        self.assertFalse(self.store.update_twin(running['id'],claim['claim'],status='succeeded',entity={}))
        self.assertFalse(restarted.status()['busy'])
        self.assertFalse(restarted.uninstall()['installed'])

    def test_second_live_application_does_not_interrupt_an_active_peer(self):
        self.manager.start()
        self.manager.install()
        queued = self.queue_fixed_copy('illinois')
        peer = PluginManager(self.store,self.vision,Mock(),self.catalog)
        self.addCleanup(peer.stop)
        peer.start()
        self.assertEqual(self.store.twin_index()['jobs'][queued['recordId']]['status'],'queued')
        self.manager.stop()
        peer.stop()
        restarted = PluginManager(self.store,self.vision,Mock(),self.catalog)
        self.addCleanup(restarted.stop)
        restarted.start()
        self.assertEqual(self.store.twin_index()['jobs'][queued['recordId']]['status'],'interrupted')

    def test_install_delete_restart_reinstall_keeps_entities_models_and_backup(self):
        before = self.store.backup()
        self.assertFalse(self.manager.status()['installed'])
        with self.assertRaises(ValidationError): self.manager.facade.start_task({})
        installed = self.manager.install(0)
        self.assertTrue(installed['installed'])
        self.assertEqual(installed['revision'], 1)
        jobs = self.store.twin_index()['jobs']
        self.assertEqual(len(jobs), 3)
        job = next(iter(jobs.values()))
        model = job['models']['files']['jewel-case.glb']
        path = self.store.published_twin_model_asset(job['id'], 'jewel-case.glb')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        self.assertEqual(digest, model['sha256'])
        backup = self.store.backup()
        self.manager.uninstall(1)
        self.assertFalse(self.manager.folder.exists())
        self.assertTrue(path.is_file())
        self.assertEqual(self.store.backup()['records'], before['records'])
        self.assertEqual(self.store.backup()['sales'], before['sales'])
        self.assertEqual(self.store.backup()['shipments'], before['shipments'])
        restarted = PluginManager(self.store, self.vision, Mock(), self.catalog)
        self.addCleanup(restarted.stop)
        self.assertFalse(restarted.status()['installed'])
        self.assertEqual(restarted.facade.index()['jobs'], jobs)
        self.store.restore_backup(backup)
        self.assertFalse(restarted.status()['installed'], 'backup must not reinstall executables')
        self.assertEqual(self.store.twin_index()['jobs'], jobs)
        restarted.install()
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), digest)
        self.assertEqual(self.store.twin_index()['jobs'], jobs)

    def test_revision_idempotency_and_two_managers(self):
        second = PluginManager(self.store, self.vision, Mock(), self.catalog)
        self.assertEqual(self.manager.install(0)['revision'],1)
        with self.assertRaises(ConflictError): second.uninstall(0)
        self.assertTrue(second.status()['installed'])
        self.assertEqual(second.install(1)['revision'], 1)
        self.assertEqual(second.uninstall(1)['revision'], 2)
        self.assertEqual(second.uninstall(2)['revision'], 2)
        with self.assertRaises(ConflictError): self.manager.install(1)

    def test_busy_job_blocks_uninstall_without_mutating_task(self):
        self.manager.install()
        record = next(r for r in self.store.state()['records'] if r['id'] == self.ids['illinois'])
        # Existing samples use a published job. A new request with explicit retry
        # represents the same fixed copy, without inventing another album roster.
        previous = self.store.twin_index()['jobs'][record['id']]['id']
        from storage import uid
        record = next(r for r in self.store.state()['records'] if r['id'] == self.ids['illinois'])
        self.store.save({'id':record['id'],'revision':record['revision'],'title':record['title'] + ' (corrected)'})
        record = next(r for r in self.store.state()['records'] if r['id'] == record['id'])
        result = self.store.start_twin({'recordId':record['id'],'recordRevision':record['revision'],'requestId':uid(),'expectedJobId':previous})
        self.assertEqual(result['job']['status'], 'queued')
        before = self.store.twin_index()
        with self.assertRaises(ConflictError): self.manager.uninstall()
        self.assertEqual(self.store.twin_index(), before)
        self.assertTrue(self.manager.folder.exists())

    def test_empty_packaging_bindings_keep_note_and_cost_edits_valid_installed_or_uninstalled(self):
        from copy import deepcopy
        from twins import TWIN_KEY, same_appearance
        rid = self.ids['illinois']
        self.manager.install()
        original = deepcopy(self.store.twin_index()['jobs'][rid])
        snapshot = deepcopy(self.store.backup()['settings'][TWIN_KEY]['jobs'][original['id']]['input'])
        for installed in (True, False):
            with self.subTest(installed=installed):
                if not installed: self.manager.uninstall()
                record = next(r for r in self.store.state()['records'] if r['id'] == rid)
                package_value = {**record['packaging'], 'photos':{}, 'photoRegions':{}}
                self.store.save({'id':rid,'revision':record['revision'],'packaging':package_value,
                                 'note':'fixed-sample note only','price':'11'})
                updated = self.store.twin_index()['jobs'][rid]
                self.assertEqual(updated['status'],'succeeded')
                self.assertEqual(updated['entity'], original['entity'])
                self.assertEqual(updated['models'], original['models'])
                saved = next(r for r in self.store.state()['records'] if r['id'] == rid)
                saved_before = deepcopy(saved)
                self.assertTrue(same_appearance(saved,snapshot))
                self.assertEqual(saved,saved_before, 'appearance comparison must be read-only')
                self.assertEqual(self.store.backup()['settings'][TWIN_KEY]['jobs'][original['id']]['input'],snapshot)
                self.store.save({'id':rid,'revision':saved['revision'],
                                 'packaging':{**saved['packaging'],'photos':{'front':0}}})
                self.assertEqual(self.store.twin_index()['jobs'][rid]['status'],'stale')
                changed = next(r for r in self.store.state()['records'] if r['id'] == rid)
                self.store.save({'id':rid,'revision':changed['revision'],
                                 'packaging':{**changed['packaging'],'photos':{}}})
                self.assertEqual(self.store.twin_index()['jobs'][rid]['status'],'succeeded')

    def test_authored_camera_and_models_survive_all_edits_backup_and_plugin_lifecycle(self):
        from tools.seed_samples import MODEL_SAMPLE_PRESENTATIONS
        self.manager.install()
        rid = self.ids['illinois']
        job = self.store.twin_index()['jobs'][rid]
        ident = job['id']; models = job['models']
        profile = MODEL_SAMPLE_PRESENTATIONS['illinois']
        def verify(updated):
            self.assertEqual(updated['entity']['presentation'], profile)
            self.assertEqual(updated['entity']['document']['presentation'], profile)
            self.assertEqual(self.store.twin_index()['jobs'][rid]['models'], models)
        verify(job)
        verify(self.store.set_twin_accessories(ident, [], {})['job'])
        verify(self.store.set_twin_spine_surface({'id':ident,'sourceRole':'front',
            'region':[.01,.01,.03,.01,.03,.99,.01,.99]})['job'])
        verify(self.store.set_twin_disc_calibration({'id':ident,'role':'disc',
            'calibration':{'source':'manual','outer':{'cx':.5,'cy':.5,'rx':.4,'ry':.4,'angle':0}}})['job'])
        record = next(r for r in self.store.state()['records'] if r['id'] == rid)
        self.store.save({'id':rid,'revision':record['revision'],'note':'fixture camera unchanged','price':'10'})
        verify(self.store.twin_index()['jobs'][rid])
        expected = self.store.twin_index()['jobs'][rid]['entity']
        backup = json.loads(json.dumps(self.store.backup()))
        self.manager.uninstall()
        reopened = open_store(self.root / 'user')
        self.assertEqual(reopened.twin_index()['jobs'][rid]['entity'], expected)
        reopened.restore_backup(backup)
        self.assertEqual(reopened.twin_index()['jobs'][rid]['entity'], expected)
        self.manager.install()
        verify(self.store.twin_index()['jobs'][rid])

    def test_shipped_package_real_model_bytes_survive_uninstall_restart_and_reinstall(self):
        shipped = PluginManager(self.store, self.vision, Mock())
        self.addCleanup(shipped.stop)
        self.assertTrue(shipped.status()['available'], 'shipped official catalog must be packaged')
        shipped.install()
        self.assertIn('_diedu_album_engine_', type(shipped.service()).__module__)
        jobs = self.store.twin_index()['jobs']
        models = {job['id']:job['models'] for job in jobs.values()}
        self.assertTrue(all(len(model['files']) >= 10 for model in models.values()))
        original = {}
        for job in jobs.values():
            for name, item in job['models']['files'].items():
                path = self.store.published_twin_model_asset(job['id'],name)
                original[(job['id'],name)] = hashlib.sha256(path.read_bytes()).hexdigest()
                self.assertEqual(original[(job['id'],name)],item['sha256'])
                if name.endswith('.glb'): self.assertEqual(path.read_bytes()[:4],b'glTF')
        shipped.uninstall()
        self.assertFalse(shipped.folder.exists())
        reopened = PluginManager(self.store,self.vision,Mock())
        self.addCleanup(reopened.stop)
        self.assertFalse(reopened.status()['installed'])
        reopened.install()
        self.assertEqual({job['id']:job['models'] for job in self.store.twin_index()['jobs'].values()},models)
        for (ident,name),digest in original.items():
            self.assertEqual(hashlib.sha256(self.store.published_twin_model_asset(ident,name).read_bytes()).hexdigest(),digest)

    def test_upgrade_keeps_previous_job_model_hashes_and_scopes_modules_by_version(self):
        self.manager.install()
        job = next(iter(self.store.twin_index()['jobs'].values()))
        models = job['models']
        old_path = self.store.published_twin_model_asset(job['id'], 'jewel-case.glb')
        old_bytes = old_path.read_bytes()
        package(self.catalog, version='0.3.1')
        status = self.manager.install(1)
        self.assertEqual(status['version'], '0.3.1')
        self.assertIn('/0.3.1/browser/plugin.js', status['entryUrl'])
        self.assertEqual(self.store.twin_index()['jobs'][job['recordId']]['models'], models)
        self.assertEqual(old_path.read_bytes(), old_bytes)
        self.assertNotEqual(self.manager.asset('models/packaging/jewel-case.glb').read_bytes(), old_bytes)
        with self.assertRaises(ValidationError): self.manager.asset('browser/plugin.js', version='0.3.0')

    def test_concurrent_install_uses_one_revision_and_one_installation(self):
        from concurrent.futures import ThreadPoolExecutor
        second = PluginManager(self.store, self.vision, Mock(), self.catalog)
        def install(manager):
            try: return manager.install(0)['revision']
            except ConflictError: return 'stale'
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(install, [self.manager, second]))
        self.assertCountEqual(results, [1, 'stale'])
        self.assertEqual(self.store.plugin_state()['revision'],1)
        self.assertEqual([p.name for p in self.manager.folder.iterdir()], ['0.3.0'])

    def test_runtime_is_lazy_and_instance_namespaced(self):
        self.manager.start()
        self.manager.install()
        self.assertIsNone(self.manager._runtime)
        first = self.manager.service()
        other = PluginManager(self.store, self.vision, Mock(), self.catalog)
        self.addCleanup(other.stop)
        second = other.service()
        self.assertIsNot(type(first), type(second))
        with self.assertRaisesRegex(ValidationError, 'fixture-invalid'): self.manager.facade.invalid()
        self.manager.uninstall()
        self.assertIsNone(self.manager._runtime)

    def test_rejects_traversal_symlink_duplicates_checksum_and_protocol(self):
        cases = [dict(extra=('../escape',b'bad',0)),
                 dict(extra=('link',b'../outside',stat.S_IFLNK | 0o777)),
                 dict(extra=('browser/plugin.js',b'duplicate',0)),
                 dict(corrupt=True), dict(protocol=9), dict(runtime_version='9.9.9')]
        for args in cases:
            with self.subTest(args=args):
                package(self.catalog, **args)
                with self.assertRaises(ValidationError): self.manager.install()
                self.assertFalse(self.manager.status()['installed'])
                self.assertEqual(self.store.plugin_state()['revision'],0)
                self.assertFalse((self.root / 'escape').exists())
        archive = package(self.catalog)
        archive.write_bytes(archive.read_bytes() + b'tampered')
        with self.assertRaises(ValidationError): self.manager.install()

    def test_private_asset_allowlist_and_corruption_do_not_break_ledger(self):
        self.manager.install()
        for name in ('../manifest.json','runtime/album_engine/worker.py','manifest.json','browser/../manifest.json'):
            with self.assertRaises(ValidationError): self.manager.asset(name)
        self.assertEqual(self.manager.asset('browser/plugin.js').read_bytes()[:6], b'export')
        self.manager.asset('browser/plugin.js').write_bytes(b'corrupt')
        self.assertFalse(self.manager.status()['installed'])
        self.assertIn('损坏', self.manager.status()['error'])
        self.assertEqual(len(self.store.state()['records']),21)
        self.manager.install()
        self.assertTrue(self.manager.status()['installed'])

    def test_build_without_plugin_has_core_services_and_no_engine_import(self):
        import subprocess, sys
        script = 'import app,sys,tempfile; s=app.build(tempfile.mkdtemp()); assert not s.plugins.status()["installed"]; assert not any(n.startswith("vendor.album_engine") for n in sys.modules); assert s.catalog_art; s.releases.close()'
        subprocess.run([sys.executable,'-W','ignore::ResourceWarning','-c',script],check=True,capture_output=True)

    def test_authentication_and_csrf_cover_install_assets_and_uninstall(self):
        auth = Auth(self.root / 'auth.sqlite3')
        auth.set_password('protocol-test-password')
        services = Services(store=self.store, auth=auth, plugins=self.manager, twins=self.manager.facade)
        server = ThreadingHTTPServer(('127.0.0.1',0),make_handler(services))
        thread = threading.Thread(target=server.serve_forever,daemon=True); thread.start()
        self.addCleanup(server.server_close); self.addCleanup(server.shutdown)
        conn = HTTPConnection('127.0.0.1', server.server_port)
        self.addCleanup(conn.close)
        for method, path in [('GET','/api/plugins/album-engine'),('GET','/api/plugins/album-engine/assets/browser/plugin.js'),('POST','/api/plugins/album-engine/install')]:
            conn.request(method,path,body='{}' if method=='POST' else None,headers={'Content-Type':'application/json'})
            response=conn.getresponse();response.read();self.assertEqual(response.status,401)
        conn.request('POST','/api/plugins/album-engine/install',body='{}',headers={'Content-Type':'application/json','Origin':'https://attacker.invalid'})
        response=conn.getresponse();response.read();self.assertEqual(response.status,403)
        token = auth.login('protocol-test-password','127.0.0.1')
        headers = {'Cookie':'album_session=' + token, 'Content-Type':'application/json'}
        conn.request('POST','/api/plugins/album-engine/install',body='{"expectedRevision":0}',headers=headers)
        response=conn.getresponse();status=json.loads(response.read());self.assertEqual(response.status,200)
        conn.request('GET',status['entryUrl'],headers=headers)
        response=conn.getresponse();self.assertEqual(response.read()[:6],b'export');self.assertEqual(response.status,200)
        conn.request('POST','/api/plugins/album-engine/uninstall',body='{"expectedRevision":0}',headers=headers)
        response=conn.getresponse();response.read();self.assertEqual(response.status,409)
        conn.request('POST','/api/plugins/album-engine/uninstall',body='{"expectedRevision":1}',headers=headers)
        response=conn.getresponse();response.read();self.assertEqual(response.status,200)
        self.assertFalse(self.manager.folder.exists())


