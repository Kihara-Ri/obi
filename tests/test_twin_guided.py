"""Entire no-vision guided CD flow against the existing Store and fake sources."""
import copy
import tempfile
import unittest
from pathlib import Path

from domain import ValidationError
from storage import Store, uid
from twins import clean_entity, clean_registry, TWIN_KEY, entity_assets
from server.digital_twins import DigitalTwinService
from server.twin_guided import candidate_images, validated_mapping

from test_digital_twins import PNG, PHOTO, EDITION, BARCODE


class OfflineVision:
    def __init__(self): self.calls = 0
    def public_config(self): return {'configured': False}
    def agent_json(self, *args, **kwargs):
        self.calls += 1
        raise AssertionError('No-vision flow cannot contact a visual model')


class Metadata:
    def get(self, path, params):
        if path == 'release': return {'count':1, 'releases':[{'id':EDITION, 'barcode':BARCODE}]}
        return {'id':EDITION,'barcode':BARCODE,'title':'Synthetic sleeve',
                'country':'JP', 'packaging':'Cardboard/Paper Sleeve',
                'artist-credit':[{'name':'Test Artist'}], 'relations':[],
                'media':[{'position':1,'format':'CD','tracks':[]}],
                'label-info':[{'catalog-number':'DEMO-001'}]}


class Archive:
    def catalog(self, edition):
        assert edition == EDITION
        return {'images': [{'id':i, 'types':[kind]} for i,kind in
                           ((101,'Front'),(102,'Back'),(103,'Medium'),(104,'Booklet'),(105,'Other'))]}
    def image(self, edition, ident, preview=False):
        assert edition == EDITION and ident in ('101','102','103','104','105')
        return PNG


class GuidedTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.store=Store(Path(self.temp.name)/'albums.sqlite3')
        self.store.set_modules({'showcase':True,'acquisition':False,'trading':False,'circulation':False})
        self.rid=self.store.save({'title':'Synthetic sleeve','artist':'Test Artist','photos':[PHOTO]})['ids'][0]
        record=next(r for r in self.store.state()['records'] if r['id']==self.rid)
        self.store.save({'id':self.rid,'revision':record['revision'],
                         'releaseInfo':{'barcode':BARCODE,'musicBrainzReleaseId':EDITION}})
        self.model=OfflineVision()
        self.service=DigitalTwinService(self.store,self.model,Metadata(),Archive())
    def tearDown(self):
        self.service.stop();self.temp.cleanup()
    def launch(self):
        record=next(r for r in self.store.state()['records'] if r['id']==self.rid)
        job=self.store.start_twin({'recordId':self.rid,'recordRevision':record['revision'],
                                    'requestId':uid(),'mode':'guided'})['job']
        self.assertEqual(job['generationMode'],'guided')
        self.service.run_one()
        reviewed=self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(reviewed['status'],'needs_input')
        self.assertEqual(reviewed['phase'],'awaiting_art_selection')
        self.assertEqual(reviewed['releaseId'],EDITION)
        return reviewed
    def selection(self):
        return {'packaging':{'structure':'card-sleeve','holder':'pocket','miniLP':True,'discs':1},
                'surfaces':{'front':'caa:101','back':'caa:102','disc':'caa:103'},
                'components':[{'kind':'obi','sourceId':'caa:105'},
                              {'kind':'booklet','sourceId':'caa:104'}]}
    def test_without_vision_success_with_independent_accessories_and_backup(self):
        original=copy.deepcopy(next(r for r in self.store.state()['records'] if r['id']==self.rid))
        job=self.launch()
        self.store.select_twin_art({'id':job['id'],'selection':self.selection()})
        self.service.run_one()
        current=self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(current['status'],'succeeded',current['error'])
        self.assertEqual(self.model.calls,0)
        self.assertEqual(current['entity']['packaging']['structure'],'card-sleeve')
        self.assertEqual([c['kind'] for c in current['entity']['components']],['obi','booklet'])
        for asset in entity_assets(current['entity']):
            self.assertTrue(self.store.published_twin_asset(current['id'],asset).is_file())
        self.assertEqual(next(r for r in self.store.state()['records'] if r['id']==self.rid),original)
        backup=self.store.backup()
        clean_registry(backup['settings'][TWIN_KEY])
    def test_edit_published_accessories_without_regenerating_case(self):
        job=self.launch()
        self.store.select_twin_art({'id':job['id'],'selection':self.selection()})
        self.service.run_one()
        published=self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(published['status'],'succeeded')
        original=copy.deepcopy(published['entity']['surfaces'])
        record=copy.deepcopy(next(r for r in self.store.state()['records'] if r['id']==self.rid))
        response=self.service.update_accessories({'id':published['id'],
            'components':[{'kind':'obi','sourceId':'caa:105'}]})
        self.assertEqual(response['job']['status'],'succeeded')
        self.assertEqual(response['job']['entity']['surfaces'],original)
        self.assertEqual([c['kind'] for c in response['job']['entity']['components']],['obi'])
        self.assertEqual(self.model.calls,0)
        self.assertEqual(next(r for r in self.store.state()['records'] if r['id']==self.rid),record)
        self.assertTrue(self.store.published_twin_asset(published['id'],'caa-105.png').is_file())
        self.assertEqual(self.service.update_accessories({'id':published['id'],'components':[]})
                         ['job']['entity'].get('components'),None)
        from twins import clean_registry
        clean_registry(self.store.backup()['settings'][TWIN_KEY])

    def test_edit_published_rejects_noncatalogued_attachment(self):
        job=self.launch()
        self.store.select_twin_art({'id':job['id'],'selection':self.selection()})
        self.service.run_one()
        # The shared engine validates catalogue ownership before any update
        # transaction; this is more precise than the old generic version error.
        with self.assertRaisesRegex(ValidationError,'附件图片必须来自已确认的图集'):
            self.service.update_accessories({'id':job['id'],
                'components':[{'kind':'obi','sourceId':'https://not-a-verified-source.invalid'}]})
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['status'],'succeeded')

    def test_art_preview_proxy_only_returns_catalogued_image(self):
        job=self.launch()
        self.assertEqual(self.service.guided_image(job['id'],0),PNG)
        self.assertEqual(self.service.guided_image(job['id'],4,'caa:101'),PNG)
        with self.assertRaisesRegex(ValidationError,'来源'):
            self.service.guided_image(job['id'],0,'caa:999')

        with self.assertRaisesRegex(ValidationError,'图片编号'):
            self.service.guided_image(job['id'],9)
        with self.assertRaisesRegex(ValidationError,'图片编号'):
            self.service.guided_image(job['id'],-1)
        self.assertEqual(self.model.calls,0)

    def test_bad_photo_and_unverified_source_are_rejected_without_queuing(self):
        job=self.launch()
        for bad in ('https://somewhere.invalid/cover.jpg','discogs:999:0','caa:999'):
            selection=self.selection();selection['surfaces']['front']=bad
            with self.assertRaises(ValidationError):
                self.store.select_twin_art({'id':job['id'],'selection':selection})
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['phase'],'awaiting_art_selection')
        self.assertEqual(self.model.calls,0)
    def test_user_must_supply_disc_face_and_cannot_change_cd_count(self):
        job=self.launch()
        selection=self.selection();selection['surfaces'].pop('disc')
        self.store.select_twin_art({'id':job['id'],'selection':selection})
        self.service.run_one()
        status=self.store.twin_index()['jobs'][self.rid]
        self.assertEqual(status['status'],'needs_input')
        self.assertIn('disc',status['error'])
        with self.assertRaises(ValidationError):
            validated_mapping({'packaging':{'structure':'card-sleeve','discs':2},
                               'surfaces':{'front':'caa:101'}},{'caa:101'},1)
    def test_known_package_mismatch_needs_explicit_physical_confirmation(self):
        from server.twin_guided import validated_mapping
        allowed={'caa:101','caa:102','caa:103'}
        release={'packaging':'Cardboard/Paper Sleeve'}
        selection={'packaging':{'structure':'jewel','discs':1},
                   'surfaces':{'front':'caa:101','back':'caa:102','disc':'caa:103'}}
        with self.assertRaisesRegex(ValidationError,'封装'):
            validated_mapping(selection,allowed,1,release)
        selection['confirmedPackagingOverride']=True
        plan,ids=validated_mapping(selection,allowed,1,release)
        self.assertTrue(plan['confirmedPackagingOverride'])
        self.assertEqual(set(ids),allowed)

    def test_invalid_accessory_cannot_use_nonallowlisted_image(self):
        job=self.launch()
        selection=self.selection(); selection['components'][0]['sourceId']='caa:999'
        with self.assertRaisesRegex(ValidationError,'附件'):
            self.store.select_twin_art({'id':job['id'],'selection':selection})


if __name__=='__main__':
    unittest.main()
