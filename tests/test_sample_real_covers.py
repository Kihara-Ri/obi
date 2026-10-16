"""Offline tests for exact-match iTunes digital art with CAA fallback."""
import base64
import tempfile
import unittest
from pathlib import Path

from tools import fetch_sample_covers as workflow
from tools import seed_samples


class _AmbiguousCoverService:
    def __init__(self):
        self.download_calls=0
    def archive_candidates(self, title, artist):
        return [
            {'exact':True, 'provider':'MusicBrainz / Cover Art Archive',
             'token':'CAA-11111111-1111-1111-1111-111111111111'},
            {'exact':True, 'provider':'MusicBrainz / Cover Art Archive',
             'token':'CAA-22222222-2222-2222-2222-222222222222'},
        ]
    def download(self, token):
        self.download_calls+=1
        raise AssertionError('Ambiguous candidate should never be downloaded')


class SampleCoverWorkflowTests(unittest.TestCase):
    def test_no_fabricated_art_and_ambiguous_matches_do_not_choose(self):
        with tempfile.TemporaryDirectory() as tmp:
            ids=seed_samples.seed(tmp)
            service=_AmbiguousCoverService()
            records=seed_samples.open_store(tmp).state()['records']
            self.assertEqual(len(records),21)
            self.assertFalse(any(r.get('cover') or r.get('photoCount') for r in records))
            result=workflow.fetch_covers(tmp,ids,service)
            self.assertEqual(service.download_calls,0)
            self.assertTrue(all(row['status']=='no-unique-match' for row in result))
            self.assertFalse(any(r.get('cover') for r in seed_samples.open_store(tmp).state()['records']))
            self.assertTrue((Path(tmp)/'musicbrainz-cover-report.json').is_file())

    def test_legacy_purge_does_not_remove_unrecognized_or_real_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            ids=seed_samples.seed(tmp)
            record=next(x for x in seed_samples.open_store(tmp).state()['records'] if x['id']==ids['islands-jp'])
            self.assertEqual(workflow.purge_synthetic(tmp,ids),{'covers':0,'photos':0})
            self.assertEqual(seed_samples.open_store(tmp).state()['records'][-1].get('cover',''),'')


class _DigitalCoverService:
    def __init__(self):
        self.downloads=[]
        self.artwork='data:image/png;base64,'+base64.b64encode(
            bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082')
        ).decode('ascii')
    def layered_search(self, title, artist):
        return {'candidates':[{'exact':True,'provider':'iTunes','token':'JP-digital'}]}
    def archive_candidates(self, title, artist):
        raise AssertionError('CAA should not be consulted after exact iTunes match')
    def download(self, token):
        self.downloads.append(token)
        return {'cover':self.artwork,'coverSource':{'title':'Digital album','artist':'Fixture',
            'provider':'iTunes','page':'https://music.apple.com/test','url':'https://is1-ssl.mzstatic.com/test','country':'JP'}}

class DigitalCoverPreferenceTests(unittest.TestCase):
    def test_exact_itunes_preferred_and_second_run_preserves_selected_art(self):
        with tempfile.TemporaryDirectory() as tmp:
            ids=seed_samples.seed(tmp)
            service=_DigitalCoverService()
            result=workflow.fetch_covers(tmp,ids,service)
            self.assertEqual(len(result),21)
            self.assertTrue(all(row['status']=='saved' for row in result))
            records=seed_samples.open_store(tmp).state()['records']
            self.assertTrue(all(r['coverSource']['provider']=='iTunes' for r in records))
            self.assertTrue(all(r['cover'].startswith('/api/cover/') for r in records))
            old_count=len(service.downloads)
            again=workflow.fetch_covers(tmp,ids,service)
            self.assertTrue(all(row['status']=='existing' for row in again))
            self.assertEqual(old_count,len(service.downloads))

    def test_only_existing_caa_images_upgrade(self):
        with tempfile.TemporaryDirectory() as tmp:
            ids=seed_samples.seed(tmp)
            store=seed_samples.open_store(tmp)
            r=next(x for x in store.state()['records'] if x['id']==ids['tpab'])
            image=_DigitalCoverService().artwork
            store.save({'id':r['id'],'revision':r['revision'],'cover':image,
                        'coverSource':{'title':'To Pimp a Butterfly','artist':'Kendrick Lamar',
                            'provider':'MusicBrainz / Cover Art Archive'}})
            r=next(x for x in store.state()['records'] if x['id']==ids['tpab'])
            before=r['cover']
            service=_DigitalCoverService()
            result=workflow.fetch_covers(tmp,ids,service)
            self.assertEqual(next(x for x in result if x['key']=='tpab')['status'],'upgraded-to-itunes')
            updated=next(x for x in store.state()['records'] if x['id']==ids['tpab'])
            self.assertEqual(updated['coverSource']['provider'],'iTunes')
            self.assertEqual(updated['cover'],before)  # test source pixel fixture shared; metadata changed
