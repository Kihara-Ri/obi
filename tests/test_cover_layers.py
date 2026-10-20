import json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from covers import CoverService,album_key,artwork_url
from domain import ValidationError

class LayerTests(unittest.TestCase):
    def album(self,title,id=1):
        return {'collectionId':id,'collectionName':title,'artistName':'Green Day','artworkUrl100':f'https://is1-ssl.mzstatic.com/{id}/100x100bb.jpg'}
    def test_catalog_reused_across_titles_and_restart(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'cache.sqlite3';s=CoverService(path)
            def read(url,limit):
                return json.dumps({'results':[{'artistId':10,'artistName':'Green Day'}] if '/search?' in url else [self.album('Dookie'),self.album('American Idiot',2)]}).encode()
            with patch.object(s,'read',side_effect=read) as calls,patch('covers.time.sleep'):
                a=s.search('Dookie','Green Day');b=s.search('American Idiot','Green Day')
                self.assertEqual(calls.call_count,2);self.assertTrue(a['candidates'][0]['exact']);self.assertTrue(b['candidates'][0]['exact'])
            s2=CoverService(path)
            with patch.object(s2,'read',side_effect=AssertionError('cache missed')):
                self.assertTrue(s2.search('Dookie','Green Day')['candidates'][0]['exact'])
    def test_fallback_only_when_needed(self):
        s=CoverService()
        with patch.object(s,'artist_catalog',return_value=[self.album('Dookie')]),patch.object(s,'term_candidates',return_value=[]) as term,patch.object(s,'archive_candidates') as archive:
            s.search('Dookie','Green Day');archive.assert_not_called();term.assert_not_called()  # exact 命中，兜底腿不跑
        with patch.object(s,'artist_catalog',return_value=[]),patch.object(s,'term_candidates',return_value=[]) as term,patch.object(s,'archive_candidates',return_value=[]) as archive:
            s.search('Other','Green Day');term.assert_called();archive.assert_called_once()
    def test_term_leg_finds_without_archive(self):
        s=CoverService();c={'token':'JP-9','title':'歌物語2 -〈物語〉シリーズ主題歌集-','artist':'物語シリーズ','thumbnail':'https://is1-ssl.mzstatic.com/9/100x100bb.jpg','year':'2015','provider':'iTunes','score':.968,'exact':True}
        with patch.object(s,'artist_catalog',return_value=[]),patch.object(s,'term_candidates',return_value=[c]) as term,patch.object(s,'archive_candidates') as archive:
            result=s.search('歌物語2','物語シリーズ')
            self.assertEqual(result['candidates'][0]['token'],'JP-9');archive.assert_not_called();self.assertEqual(term.call_count,1)  # JP 命中即止
    def test_unavailable_primary_still_uses_archive(self):
        s=CoverService()
        with patch.object(s,'artist_catalog',side_effect=ValidationError('offline')),patch.object(s,'term_candidates',side_effect=ValidationError('offline')),patch.object(s,'archive_candidates',return_value=[]) as archive:
            result=s.search('Other','Green Day');self.assertEqual(len(result['warnings']),4);archive.assert_called_once()
    def test_slow_itunes_does_not_delay_archive_leg(self):
        import threading
        s=CoverService();archive_started=threading.Event()
        def slow_catalog(artist,country):
            self.assertTrue(archive_started.wait(2),'iTunes 仍在查时 MusicBrainz 一腿应并行启动')
            return []
        def archive(title,artist):
            archive_started.set();return []
        with patch.object(s,'artist_catalog',side_effect=slow_catalog),patch.object(s,'term_candidates',return_value=[]),patch.object(s,'archive_candidates',side_effect=archive):
            result=s.layered_search('Other','Green Day',hedge=0.05)
        self.assertEqual(result['checked'][-1],'MusicBrainz / Cover Art Archive')
    def test_archive_exact_hit_stops_slow_itunes_leg(self):
        import threading,time
        s=CoverService();release=threading.Event();calls=[]
        hit={'token':'CAA-1','title':'Other','artist':'Green Day','thumbnail':'https://coverartarchive.org/x.jpg','year':'2000','provider':'MusicBrainz / Cover Art Archive','score':1.0,'exact':True}
        def slow_catalog(artist,country):
            calls.append(country);release.wait(3);return []
        with patch.object(s,'artist_catalog',side_effect=slow_catalog),patch.object(s,'term_candidates',return_value=[]) as term,patch.object(s,'archive_candidates',return_value=[hit]):
            started=time.monotonic();result=s.layered_search('Other','Green Day',hedge=0.05)
            elapsed=time.monotonic()-started;release.set()
        self.assertLess(elapsed,1.5);self.assertEqual(result['candidates'][0]['token'],'CAA-1')
        time.sleep(0.2);self.assertEqual(calls,['JP']);term.assert_not_called()   # 被叫停后不再走 US 与关键词腿
    def test_different_hosts_are_paced_independently(self):
        import threading,time
        s=CoverService();gate=threading.Event()
        def read(url,limit):
            if 'itunes.apple.com' in url: gate.wait(2)   # iTunes 请求卡住
            return json.dumps({'results':[]}).encode()
        with patch.object(s,'read',side_effect=read),patch('covers.time.sleep'):
            t=threading.Thread(target=s.metadata,args=('https://itunes.apple.com/search?term=a',));t.start()
            started=time.monotonic()
            s.metadata('https://coverartarchive.org/release/x')   # 不同主机，不应等 iTunes
            self.assertLess(time.monotonic()-started,1)
            gate.set();t.join()
    def test_live_and_deluxe_not_exact(self):
        self.assertNotEqual(album_key('Carrie & Lowell'),album_key('Carrie & Lowell Live'))
        self.assertNotEqual(album_key('Dookie'),album_key('Dookie (Deluxe Edition)'))
        self.assertEqual(album_key('Synchronicity'),album_key('Synchronicity (Remastered 2003)'))
    def test_wrong_artist_not_adopted(self):
        s=CoverService()
        with patch.object(s,'metadata',return_value={'results':[{'artistId':10,'artistName':'Other'}]}) as calls:
            self.assertEqual(s.artist_catalog('Green Day','JP'),[]);self.assertEqual(calls.call_count,1)
    def test_archive_front_and_download_provenance(self):
        s=CoverService();gid='12345678-1234-1234-1234-123456789012'
        groups={'release-groups':[{'id':gid,'title':'Dookie','artist-credit':[{'name':'Green Day'}]}]}
        releases={'releases':[{'id':'rel-cd','media':[{'format':'CD'}]}]}
        rel_images={'images':[{'front':True,'approved':True,'thumbnails':{'500':'https://archive.org/front.jpg'}}]}
        with patch.object(s,'metadata',side_effect=[groups,releases,rel_images]):
            c=s.archive_candidates('Dookie','Green Day')[0];self.assertTrue(c['exact']);self.assertIn('front.jpg',c['thumbnail'])
        with patch.object(s,'read',return_value=b'\xff\xd8\xfftest'):
            r=s.download(c['token']);self.assertIn('MusicBrainz',r['coverSource']['provider'])
    def test_archive_falls_back_to_group_front_without_cd(self):
        s=CoverService();gid='12345678-1234-1234-1234-123456789013'
        groups={'release-groups':[{'id':gid,'title':'Dookie','artist-credit':[{'name':'Green Day'}]}]}
        releases={'releases':[{'id':'rel-v','media':[{'format':'Vinyl'}]}]}
        group_images={'images':[{'front':True,'approved':True,'thumbnails':{'500':'https://archive.org/group-front.jpg'}}]}
        with patch.object(s,'metadata',side_effect=[groups,releases,group_images]):
            c=s.archive_candidates('Dookie','Green Day')[0];self.assertIn('group-front.jpg',c['thumbnail'])
    def test_archive_hosts(self):
        artwork_url('https://ia800100.us.archive.org/a.jpg')
        for u in ['https://archive.org.evil.com/a','http://archive.org/a','https://archive.org@localhost/a']:
            with self.assertRaises(ValidationError):artwork_url(u)
