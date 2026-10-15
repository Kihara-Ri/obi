import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from domain import ValidationError
from storage import Store

class AlbumFavoritesTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.store=Store(Path(self.tmp.name)/'albums.sqlite3')
        self.copy_a=self.store.save({'title':'[Led Zeppelin IV]','artist':'Led Zeppelin',
            'date':'2026-10-15','currency':'JPY','price':'1000'})['ids'][0]
        self.copy_b=self.store.save({'title':'Led Zeppelin IV','artist':'  led  zeppelin ',
            'date':'2024-06-02','currency':'CNY','price':'200','releaseInfo':{'catalogNumber':'ABC-2'}})['ids'][0]
        self.other=self.store.save({'title':'Led Zeppelin III','artist':'Led Zeppelin',
            'date':'2023-05-01'})['ids'][0]

    def tearDown(self):
        self.tmp.cleanup()

    def test_likes_are_album_level_and_do_not_change_copy_records(self):
        before={r['id']:r for r in self.store.state()['records']}
        self.assertFalse(self.store.album_favorites()['favorites'])
        response=self.store.set_album_favorite({'recordId':self.copy_a,'liked':True})
        self.assertEqual(set(response['favorites']),{self.copy_a,self.copy_b})
        self.assertEqual(response['collectedAt'][self.copy_a],'2024-06-02')
        self.assertEqual(response['collectedAt'][self.copy_b],'2024-06-02')
        self.assertEqual(response['collectedAt'][self.other],'2023-05-01')
        self.assertEqual({r['id']:r for r in self.store.state()['records']},before)
        self.assertEqual(self.store.set_album_favorite({'recordId':self.copy_b,'liked':False})['favorites'],{})
        self.assertEqual({r['id']:r for r in self.store.state()['records']},before)

    def test_preference_persists_backup_restore_and_avoids_duplicated_audit(self):
        self.store.set_album_favorite({'recordId':self.copy_a,'liked':True})
        audits=len(self.store.backup()['audit'])
        self.store.set_album_favorite({'recordId':self.copy_b,'liked':True})
        self.assertEqual(len(self.store.backup()['audit']),audits)
        saved=self.store.backup()
        restored=Store(Path(self.tmp.name)/'restored'/'albums.sqlite3')
        restored.restore_backup(saved)
        self.assertEqual(set(restored.album_favorites()['favorites']),{self.copy_a,self.copy_b})

    def test_validation_fails_closed(self):
        for payload in ({'recordId':self.copy_a,'liked':1},
                        {'recordId':self.copy_a,'liked':'true'},
                        {'recordId':self.copy_a,'liked':True,'revision':0},
                        {'recordId':'0'*32,'liked':True}):
            with self.subTest(payload=payload),self.assertRaises(ValidationError):
                self.store.set_album_favorite(payload)
        backup=self.store.backup()
        backup['settings']['album-favorites-v1']={'incorrect':False}
        with self.assertRaisesRegex(ValidationError,'喜好'):
            self.store.restore_backup(backup)

    def test_old_records_and_dates_without_date_are_supported(self):
        rec=self.store.save({'title':'Undated','artist':'Artist'})['ids'][0]
        self.assertNotIn(rec,self.store.album_favorites()['collectedAt'])
        self.assertIn(rec,self.store.set_album_favorite({'recordId':rec,'liked':True})['favorites'])


class AlbumEntityModelTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.store=Store(Path(self.tmp.name)/'db.sqlite3')
    def tearDown(self): self.tmp.cleanup()
    def record(self,title='Album',artist='Band',date='2026-10-11'):
        return self.store.save({'title':title,'artist':artist,'date':date})['ids'][0]
    def data(self,rid):
        return next(r for r in self.store.state()['records'] if r['id']==rid)
    def link(self,rid,group,expected=None):
        r=self.data(rid)
        self.store.link_record_work(rid,'11111111-1111-4111-8111-111111111111',
                                    group,expected,r['artist'],r['title'])

    def test_persisted_album_ids_survive_titles_and_backup_restore(self):
        first=self.record()
        second=self.record()
        initial=self.store.album_favorites()
        a_id=initial['recordAlbumIds'][first]
        self.assertEqual(a_id,initial['recordAlbumIds'][second])
        self.store.set_album_favorite({'recordId':first,'liked':True})
        r=self.data(first)
        self.store.save({'id':first,'revision':r['revision'],'title':'Renamed Album'})
        changed=self.store.album_favorites()
        self.assertEqual(changed['recordAlbumIds'][first],a_id)
        self.assertTrue(changed['favorites'][first])
        self.assertEqual(len(changed['albums']),1)
        backup=self.store.backup()
        saved=Store(Path(self.tmp.name)/'restored'/'db.sqlite3')
        saved.restore_backup(backup)
        again=saved.album_favorites()
        self.assertEqual(again['recordAlbumIds'][first],a_id)
        self.assertTrue(again['albums'][a_id]['liked'])

    def test_different_verified_release_groups_separate_identical_names(self):
        first=self.record()
        second=self.record()
        self.store.set_album_favorite({'recordId':first,'liked':True})
        self.link(first,'22222222-2222-4222-8222-222222222222')
        self.link(second,'33333333-3333-4333-8333-333333333333')
        model=self.store.album_favorites()
        aid1=model['recordAlbumIds'][first]
        aid2=model['recordAlbumIds'][second]
        self.assertNotEqual(aid1,aid2)
        self.assertEqual(model['albums'][aid1]['musicBrainzReleaseGroupId'],
                         '22222222-2222-4222-8222-222222222222')
        self.assertEqual(model['albums'][aid2]['musicBrainzReleaseGroupId'],
                         '33333333-3333-4333-8333-333333333333')
        self.store.set_album_favorite({'recordId':first,'liked':False})
        after=self.store.album_favorites()
        self.assertNotIn(first,after['favorites'])
        self.assertIn(second,after['favorites'])
        self.assertEqual(self.store.album_favorites()['recordAlbumIds'],model['recordAlbumIds'])

    def test_one_confirmed_release_group_can_unify_differently_named_copies(self):
        first=self.record('Original Album')
        second=self.record('Translation of Album')
        group='22222222-2222-4222-8222-222222222222'
        self.link(first,group)
        self.link(second,group)
        m=self.store.album_favorites()
        self.assertEqual(m['recordAlbumIds'][first],m['recordAlbumIds'][second])
        self.store.set_album_favorite({'recordId':first,'liked':True})
        self.assertEqual(set(self.store.album_favorites()['favorites']),{first,second})

    def test_legacy_title_key_migrates_once_without_losing_like(self):
        rid=self.record('Old Name')
        old_identity=self.store.album_identity(self.data(rid))
        with self.store.connect() as db:
            db.execute("DELETE FROM meta WHERE key IN ('album-entities-v1','album-copy-links-v1')")
            db.execute("INSERT OR REPLACE INTO meta(key,data) VALUES(?,?)",
                       ('album-favorites-v1',__import__('json').dumps({old_identity:True})))
        state=self.store.album_favorites()
        self.assertTrue(state['favorites'][rid])
        with self.store.connect() as db:
            self.assertIsNone(self.store.meta_get(db,'album-favorites-v1'))
        self.store.set_album_favorite({'recordId':rid,'liked':False})
        self.assertNotIn(rid,self.store.album_favorites()['favorites'])

    def test_backup_invalid_album_links_rejected_before_mutation(self):
        rid=self.record()
        original=self.store.backup()
        invalid=__import__('copy').deepcopy(original)
        invalid['settings']['album-copy-links-v1'][rid]='missing'
        with self.assertRaisesRegex(ValidationError,'专辑副本关联'):
            self.store.restore_backup(invalid)
        self.assertEqual(self.store.backup()['records'],original['records'])
