"""Engine runtime deployment and publication integration regressions."""
import ast
import hashlib
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class EngineRuntimeTests(unittest.TestCase):
    def test_vendored_runtime_imports_without_host_modules(self):
        code = "from album_engine import compile_document, validate_document; from album_engine.worker import DigitalTwinService; from album_engine.contracts import clean_entity"
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([sys.executable, '-I', '-c',
                "import sys; sys.path.insert(0," + repr(str(ROOT / 'vendor')) + "); " + code],
                cwd=directory, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        for path in (ROOT / 'vendor/album_engine').rglob('*.py'):
            tree = ast.parse(path.read_text())
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.level == 0:
                    self.assertNotIn((node.module or '').split('.')[0],
                                     ('server', 'domain', 'storage', 'twins', 'musicbrainz'), str(path))

    def test_fixed_sample_publication_contains_valid_document_and_calibration_recompiles(self):
        from tools.seed_samples import seed_models, open_store
        from vendor.album_engine import validate_document
        with tempfile.TemporaryDirectory() as directory:
            ids = seed_models(directory)
            store = open_store(directory)
            published = store.twin_index()['jobs'][ids['lift-fists']]
            original = copy.deepcopy(published['entity']['document'])
            validate_document(original)
            self.assertEqual(original['schemaVersion'], 2)
            calibration = {'outer': {'cx': .5, 'cy': .5, 'rx': .4, 'ry': .4, 'angle': 0}, 'source': 'manual'}
            result = store.set_twin_disc_calibration({'id': published['id'], 'role': 'disc', 'calibration': calibration})
            doc = result['job']['entity']['document']
            validate_document(doc)
            self.assertNotEqual(doc, original)
            disc = next(c for c in doc['assembly']['components'] if c['kind'] == 'disc')
            self.assertEqual(disc['surfaces']['front']['discCalibration'], calibration)

    def test_accessory_update_rebuilds_same_document_without_changing_case(self):
        from tools.seed_samples import seed_models, open_store
        from vendor.album_engine import validate_document
        with tempfile.TemporaryDirectory() as directory:
            ids = seed_models(directory); store = open_store(directory)
            before = store.twin_index()['jobs'][ids['lift-fists']]
            result = store.set_twin_accessories(before['id'], [], {})['job']['entity']
            validate_document(result['document'])
            self.assertEqual(result['surfaces'], before['entity']['surfaces'])
            self.assertEqual(result['packaging'], before['entity']['packaging'])
            self.assertFalse(any(c['kind'] in ('obi','booklet','inner-sleeve')
                                 for c in result['document']['assembly']['components']))
            self.assertNotEqual(result['document'], before['entity']['document'])

    def test_late_cancelled_worker_is_fenced_before_compilation(self):
        from tools.seed_samples import seed, open_store
        from storage import uid
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as directory:
            ids = seed(directory); store = open_store(directory)
            record = next(r for r in store.state()['records'] if r['id'] == ids['dookie-jp'])
            store.save({'id':record['id'],'revision':record['revision'],
                        'releaseInfo':{'musicBrainzReleaseId':'11111111-1111-4111-8111-111111111111','barcode':''}})
            record = next(r for r in store.state()['records'] if r['id'] == ids['dookie-jp'])
            job = store.start_twin({'recordId':record['id'],'recordRevision':record['revision'],'requestId':uid()})['job']
            claim = store.claim_twin('cancelled-runtime')
            store.cancel_twin(job['id'])
            with patch('server.album_engine_adapter.prepare_publication', side_effect=AssertionError('compiler must not run')):
                self.assertFalse(store.update_twin(job['id'], claim['claim'], status='succeeded', entity={}))
            self.assertEqual(store.twin_index()['jobs'][record['id']]['status'], 'cancelled')

    def test_restore_validates_documents_and_preserves_uncompiled_legacy_records(self):
        from tools.seed_samples import seed_models, open_store
        from twins import TWIN_KEY
        from domain import ValidationError
        with tempfile.TemporaryDirectory() as directory:
            ids = seed_models(directory); store = open_store(directory)
            backup = store.backup(); rid = ids['lift-fists']
            ident = backup['settings'][TWIN_KEY]['latest'][rid]
            invalid = copy.deepcopy(backup)
            invalid['settings'][TWIN_KEY]['jobs'][ident]['entity']['document']['assembly']['components'][-1]['parent'] = 'missing'
            with self.assertRaises(ValidationError): store.restore_backup(invalid)
            self.assertEqual(store.twin_index()['jobs'][rid]['entity']['document'],
                             backup['settings'][TWIN_KEY]['jobs'][ident]['entity']['document'])
            legacy = copy.deepcopy(backup)
            legacy['settings'][TWIN_KEY]['jobs'][ident]['entity'].pop('document')
            store.restore_backup(legacy)
            self.assertNotIn('document', store.twin_index()['jobs'][rid]['entity'])
            self.assertNotIn('document', store.backup()['settings'][TWIN_KEY]['jobs'][ident]['entity'])

    def test_legacy_edits_do_not_invent_attachment_ownership(self):
        from tools.seed_samples import seed_models, open_store
        from twins import TWIN_KEY
        calibration = {'outer': {'cx':.5,'cy':.5,'rx':.4,'ry':.4,'angle':0},'source':'manual'}
        with tempfile.TemporaryDirectory() as directory:
            ids = seed_models(directory); store = open_store(directory)
            backup = store.backup(); rid = ids['lift-fists']
            ident = backup['settings'][TWIN_KEY]['latest'][rid]
            legacy = backup['settings'][TWIN_KEY]['jobs'][ident]['entity']
            legacy.pop('document')
            source = legacy['components'][0]
            raw = store.twin_source(ident, source['asset']).read_bytes()
            for operation in ('disc', 'spine', 'accessories'):
                with self.subTest(operation=operation):
                    store.restore_backup(copy.deepcopy(backup))
                    self.assertNotIn('document',store.twin_index()['jobs'][rid]['entity'])
                    if operation == 'disc':
                        result = store.set_twin_disc_calibration({'id':ident,'role':'disc','calibration':calibration})
                    elif operation == 'spine':
                        result = store.set_twin_spine_surface({'id':ident,'sourceRole':'front','region':[.01,.01,.03,.01,.03,.99,.01,.99]})
                    else:
                        result = store.set_twin_accessories(ident,[{'id':source['id'],'kind':source['kind'],'sourceId':'saved'}],{'saved':(source,raw)})
                    self.assertNotIn('document',result['job']['entity'])
                    self.assertNotIn('document',store.backup()['settings'][TWIN_KEY]['jobs'][ident]['entity'])

    def test_worker_receives_only_narrow_vision_capabilities(self):
        from server.digital_twins import DigitalTwinService
        from tools.seed_samples import seed, open_store
        class HostVision:
            def __init__(self):
                self.store = object(); self.covers = object(); self.mb = object()
                self.config = {'apiKey':'synthetic-secret'}; self.calls=[]
            def public_config(self): return {'configured':True,'apiKey':'synthetic-secret','model':'host-model'}
            def agent_json(self, system, prompt, images=(), on_start=None):
                self.calls.append((system,prompt,images))
                if on_start: on_start()
                return {'ok':True}
        with tempfile.TemporaryDirectory() as directory:
            seed(directory); store=open_store(directory); host=HostVision()
            service=DigitalTwinService(store,host,object())
            self.assertIsNot(service.vision,host)
            self.assertEqual(service.vision.public_config(),{'configured':True})
            for name in ('store','config','covers','mb','__dict__'):
                self.assertFalse(hasattr(service.vision,name),name)
            started=[]
            result=service.vision.agent_json('system','prompt',['image'],on_start=lambda:started.append(True))
            self.assertEqual(result,{'ok':True}); self.assertEqual(started,[True])
            self.assertEqual(host.calls,[('system','prompt',['image'])])
            host.agent_json = lambda *args,**kwargs: {'updated':True}
            self.assertEqual(service.vision.agent_json('system','next'),{'updated':True})

    def test_shared_contract_is_packaged(self):
        contract = json.loads((ROOT / 'vendor/album_engine/model-set.json').read_text())
        self.assertEqual(contract['modelSet'], 'album-rig-1')
        self.assertTrue(contract['models'])
        schema = json.loads((ROOT/'vendor/album_engine/album-document-v2.schema.json').read_text())
        self.assertEqual(schema['properties']['schemaVersion']['const'], 2)
        manifest = json.loads((ROOT / 'vendor/album_engine/runtime-manifest.json').read_text())
        self.assertEqual(manifest['schemaVersion'], 2)
        self.assertEqual(manifest['modelSet'], contract['modelSet'])
        for relative, expected in manifest['sha256'].items():
            self.assertEqual(hashlib.sha256((ROOT/'vendor/album_engine'/relative).read_bytes()).hexdigest(), expected, relative)
