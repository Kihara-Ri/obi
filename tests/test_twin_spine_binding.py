"""Spine recovery from an already published source: transactional and reversible."""
import base64
import tempfile
import unittest
from pathlib import Path

from domain import ValidationError, ConflictError
from storage import Store, uid
from twins import clean_registry, TWIN_KEY

PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')
RECT=[4/590,7/600,14/590,7/600,14/590,593/600,4/590,593/600]
BARCODE='4582237837001'
EDITION='27bdc707-c8db-427c-9173-b272e18a943f'

class SpineSurfaceBindingTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.store=Store(Path(self.tmp.name)/'albums.sqlite3')
        self.store.set_modules({'showcase':True,'acquisition':False,'trading':False,'circulation':False})
        self.rid=self.store.save({'title':'the Glow, pt. 2','artist':'The Microphones','photos':[],
                                  'releaseInfo':{'barcode':BARCODE,'musicBrainzReleaseId':EDITION}})['ids'][0]
        record=next(r for r in self.store.state()['records'] if r['id']==self.rid)
        created=self.store.start_twin({'recordId':self.rid,'recordRevision':record['revision'],
                                      'requestId':uid(),'barcode':BARCODE})['job']
        claim=self.store.claim_twin('test-spine')
        self.assertEqual(claim['id'],created['id'])
        self.jid=claim['id']
        self.store.write_twin_source(self.jid,claim['claim'],'discogs-11384187-2.jpg',PNG)
        self.store.write_twin_source(self.jid,claim['claim'],'discogs-11384187-3.jpg',PNG)
        self.store.write_twin_source(self.jid,claim['claim'],'discogs-11384187-5.jpg',PNG)
        self.front={'asset':'discogs-11384187-2.jpg','region':None,'sourceUrl':'https://i.discogs.com/discogs-11384187-2.jpg',
                    'origin':'edition-reference'}
        entity={'packaging':{'structure':'card-sleeve','discs':1,'miniLP':True},
                'surfaces':{'front':self.front.copy(),
                            'back':{'asset':'discogs-11384187-3.jpg','region':None,'sourceUrl':'','origin':'edition-reference'},
                            'disc':{'asset':'discogs-11384187-5.jpg','region':None,'sourceUrl':'','origin':'edition-reference'}},
                'warnings':[], 'release':{'id':EDITION}}
        self.assertTrue(self.store.update_twin(self.jid,claim['claim'],status='succeeded',entity=entity,
                                               releaseId=EDITION))
    def tearDown(self):
        self.tmp.cleanup()

    def test_narrow_spine_uses_existing_published_asset_and_reopens_from_backup(self):
        result=self.store.set_twin_spine_surface({'id':self.jid,'sourceRole':'front','region':RECT})
        job=result['job']
        self.assertEqual(job['status'],'succeeded')
        spine=job['entity']['surfaces']['spine']
        self.assertEqual(spine['asset'],'discogs-11384187-2.jpg')
        self.assertEqual(spine['sourceUrl'],self.front['sourceUrl'])
        self.assertEqual(spine['region'],RECT)
        self.assertEqual(len(list((self.store.path.parent/'digital-twins'/self.jid).iterdir())),3)
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['entity']['surfaces']['spine'],spine)
        self.assertEqual(Store(self.store.path).twin_index()['jobs'][self.rid]['entity']['surfaces']['spine'],spine)
        self.assertEqual(self.store.backup()['settings'][TWIN_KEY]['jobs'][self.jid]['entity']['surfaces']['spine'],spine)
        self.assertEqual(clean_registry(self.store.backup()['settings'][TWIN_KEY])['jobs'][self.jid]['entity']['surfaces']['spine'],spine)
        self.store.set_twin_spine_surface({'id':self.jid,'region':None})
        self.assertNotIn('spine',self.store.twin_index()['jobs'][self.rid]['entity']['surfaces'])

    def test_reject_injection_invalid_quad_and_unknown_source_without_modifying_entity(self):
        original=self.store.twin_index()['jobs'][self.rid]['entity']
        for body in (
            {'sourceRole':'spine','region':RECT},
            {'sourceRole':'front','region':[0,0,0.8,0,0.8,1,0,1]},
            {'sourceRole':'front','region':[0.01,0.01,0.01,0.99,0.02,0.99,0.02,0.01]},
            {'sourceRole':'back','region':[0,0,0.01,0.1,0.01,0.2,0,0.2]},
        ):
            with self.assertRaises(ValidationError):
                self.store.set_twin_spine_surface({'id':self.jid,**body})
        self.assertEqual(self.store.twin_index()['jobs'][self.rid]['entity'],original)
        with self.assertRaises(ConflictError):
            self.store.set_twin_spine_surface({'id':'f'*32,'sourceRole':'front','region':RECT})

if __name__=='__main__':unittest.main()
