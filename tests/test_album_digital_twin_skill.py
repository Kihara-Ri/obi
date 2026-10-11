"""Executable skill helpers: geometry evidence and exact-edition retrieval."""
import contextlib
import copy
import importlib.util
import io
import json
import subprocess
import struct
import sys
import tempfile
import unittest
import urllib.request
import zlib
from pathlib import Path
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1] / 'server/skills/album-digital-twin/scripts'
RID = 'e618bce6-8e08-4628-9574-2d8f53b20db7'


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def calibration_input():
    return {'sourceId': 'caa:123', 'pixels': [1000, 500], 'confirmed': True, 'samePlane': True,
            'surfaces': {'back': {'quad': [0, 0, 480, 0, 480, 500, 0, 500]},
                         'spine': {'rows': [[480, 0, 500, 0], [478, 250, 499, 250], [480, 500, 500, 500]]},
                         'front': {'quad': [500, 0, 980, 0, 980, 500, 500, 500]}}}


def reference_release():
    return {'id': RID, 'title': 'Islands', 'barcode': '4988013047105', 'media': [{'format': 'CD'}],
            'label-info': [{'catalog-number': 'PCCY-01424'}],
            'relations': [{'type': 'discogs', 'url': {'resource': 'https://www.discogs.com/release/2485482'}}]}


def reference_discogs():
    return {'id': 2485482, 'labels': [{'catno': 'PCCY-01424'}],
            'identifiers': [{'type': 'Barcode', 'value': '4988013047105'}],
            'formats': [{'name': 'CD'}], 'images': []}


def png_pixel():
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b'\0\xff\0\0')) + chunk(b'IEND', b'')


class SpineCalibrationScriptTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue((SCRIPTS / 'calibrate_spine.py').is_file(), 'executable calibration helper is missing')
        self.script = load_script('calibrate_spine')

    def test_normalizes_original_pixels_and_estimates_independent_spine_ratio(self):
        original = calibration_input()
        unchanged = copy.deepcopy(original)
        result = self.script.calibrate(original)
        self.assertEqual(original, unchanged)
        self.assertEqual(result['surfaces']['spine']['warpRows'][1], [.478, .5, .499, .5])
        self.assertEqual(result['surfaces']['front']['region'], [.5, 0, .98, 0, .98, 1, .5, 1])
        self.assertAlmostEqual(result['calibration']['spine']['widthRatio'], 20 / 480)
        self.assertEqual(result['calibration']['spine']['basis'], 'image-estimate')
        self.assertNotIn('reliefMm', result['calibration']['spine'])
        self.assertNotIn('size', result)

    def test_rejects_missing_confirmation_nonplanar_and_invalid_geometry(self):
        changes = [('confirmed', False), ('samePlane', False), ('pixels', [0, 500]), ('pixels', [1000, True])]
        for key, value in changes:
            data = calibration_input(); data[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError): self.script.calibrate(data)
        invalid_rows = [
            [[480, 0, 500, 0]],
            [[480, 0, 500, 0], [510, 500, 500, 500]],
            [[480, 0, 500, 0], [480, 500, 1001, 500]],
            [[480, 250, 500, 250], [480, 0, 500, 0]],
            [[480, 0, 500, 0], [480, float('nan'), 500, 500]],
            [[480, i, 500, i] for i in range(18)],
            [[480, 0, 500, 490], [480, 10, 500, 500]],
        ]
        for rows in invalid_rows:
            data = calibration_input(); data['surfaces']['spine'] = {'rows': rows}
            with self.subTest(rows=rows), self.assertRaises(ValueError): self.script.calibrate(data)

    def test_rejects_out_of_contract_ratio_and_unacknowledged_relief(self):
        for width in (.1, 100):
            data = calibration_input()
            data['surfaces']['spine'] = {'quad': [480, 0, 480 + width, 0, 480 + width, 500, 480, 500]}
            with self.subTest(width=width), self.assertRaises(ValueError): self.script.calibrate(data)
        data = calibration_input(); data['reliefMm'] = [0, .1, 0]
        with self.assertRaises(ValueError): self.script.calibrate(data)
        data['reliefBasis'] = 'approximate-profile'
        self.assertEqual(self.script.calibrate(data)['calibration']['spine']['reliefMm'], [0, .1, 0])
        for relief in ([0, .151, 0], [0, -.151, 0], [0, 0], [0, float('inf'), 0], [False, 0, 0]):
            data['reliefMm'] = relief
            with self.subTest(relief=relief), self.assertRaises(ValueError): self.script.calibrate(data)

    def test_cli_writes_new_json_and_preserves_existing_output_and_input(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'input.json'; output = Path(directory) / 'calibration.json'
            raw = json.dumps(calibration_input()); source.write_text(raw)
            command = [sys.executable, str(SCRIPTS / 'calibrate_spine.py'), str(source), '--output', str(output)]
            first = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            generated = output.read_bytes()
            second = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(second.returncode, 0)
            self.assertEqual(output.read_bytes(), generated)
            self.assertEqual(source.read_text(), raw)


class ReleaseArtScriptTests(unittest.TestCase):
    def setUp(self): self.script = load_script('fetch_release_art')

    def test_barcode_candidates_keep_only_exact_cd_and_wait_for_confirmation(self):
        response = {'releases': [
            {'id': RID, 'title': 'Islands', 'barcode': '4988013047105', 'media': [{'format': 'CD'}]},
            {'id': 'wrong', 'title': 'Other edition', 'barcode': '4988013047106', 'media': [{'format': 'CD'}]},
            {'id': 'vinyl', 'title': 'Islands', 'barcode': '4988013047105', 'media': [{'format': 'Vinyl'}]},
        ]}
        with patch.object(self.script, 'request', return_value=(json.dumps(response).encode(), 'resolved')):
            result = self.script.find_candidates('4988013047105')
        self.assertEqual(result['status'], 'awaiting_confirmation')
        self.assertEqual([item['releaseId'] for item in result['candidates']], [RID])
        self.assertNotIn('images', result)

    def test_discogs_accepts_only_same_release_relationship_barcode_and_catalog(self):
        mb = {'barcode': '4988013047105', 'label-info': [{'catalog-number': 'PCCY-01424'}],
              'relations': [{'type': 'discogs', 'target-type': 'url',
                             'url': {'resource': 'https://www.discogs.com/release/2485482-King-Crimson-Islands'}}]}
        discogs = {'id': 2485482, 'labels': [{'catno': 'pccy- 01424'}],
                   'identifiers': [{'type': 'Barcode', 'value': '4 988013 047105'}],
                   'formats': [{'name': 'CD', 'qty': '1'}]}
        self.assertEqual(self.script.discogs_release_ids(mb), ['2485482'])
        self.assertTrue(self.script.verify_discogs(mb, discogs))
        for key, value in [('identifiers', [{'type': 'Barcode', 'value': '4988013047106'}]),
                           ('labels', [{'catno': 'PCCY-99999'}]), ('formats', [{'name': 'Vinyl'}])]:
            wrong = dict(discogs, **{key: value})
            with self.subTest(key=key): self.assertFalse(self.script.verify_discogs(mb, wrong))
        unrelated = copy.deepcopy(mb); unrelated['relations'][0]['type'] = 'other databases'
        self.assertEqual(self.script.discogs_release_ids(unrelated), [])

    def test_mismatched_discogs_keeps_evidence_and_skips_its_images(self):
        mb = {'id': RID, 'title': 'Islands', 'barcode': '4988013047105', 'media': [{'format': 'CD'}],
              'label-info': [{'catalog-number': 'PCCY-01424'}],
              'relations': [{'type': 'discogs', 'url': {'resource': 'https://www.discogs.com/release/2485482'}}]}
        wrong = {'id': 2485482, 'labels': [{'catno': 'OTHER'}],
                 'identifiers': [{'type': 'Barcode', 'value': '4988013047105'}],
                 'formats': [{'name': 'CD'}], 'images': [{'uri': 'https://i.discogs.com/wrong.jpg'}]}
        requested = []
        def request(url):
            requested.append(url)
            raw = wrong if 'api.discogs.com' in url else {'images': []} if 'coverartarchive.org' in url else mb
            return json.dumps(raw).encode(), url
        with tempfile.TemporaryDirectory() as directory, patch.object(self.script, 'request', side_effect=request), contextlib.redirect_stdout(io.StringIO()):
            result = self.script.fetch(RID, Path(directory) / 'reference', expected_barcode='4988013047105')
        self.assertEqual(result['discogs'][0]['status'], 'identity-mismatch')
        self.assertFalse(any('wrong.jpg' in url for url in requested))
        self.assertTrue(any('url-rels' in url for url in requested))

    def test_release_cli_requires_explicit_confirmation(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'reference'
            result = subprocess.run([sys.executable, str(SCRIPTS / 'fetch_release_art.py'), RID,
                                     '--output', str(output)], capture_output=True, text=True, timeout=2)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(output.exists())

    def test_selected_release_must_match_requested_identity_before_fetching_art(self):
        wrong = {'id': '00000000-0000-0000-0000-000000000000', 'title': 'Other edition',
                 'barcode': '4988013047105', 'media': [{'format': 'CD'}]}
        with tempfile.TemporaryDirectory() as directory, patch.object(self.script, 'request', return_value=(json.dumps(wrong).encode(), 'resolved')):
            with self.assertRaises(ValueError):
                self.script.fetch(RID, Path(directory) / 'reference', expected_barcode='4988013047105')

    def test_catalog_punctuation_does_not_merge_distinct_edition_identifiers(self):
        mb = reference_release(); reference = reference_discogs()
        mb['label-info'][0]['catalog-number'] = 'ABC-01'
        reference['labels'][0]['catno'] = 'ABC/01'
        self.assertFalse(self.script.verify_discogs(mb, reference))

    def test_discogs_untrusted_image_urls_fail_before_transport(self):
        for url in ('http://i.discogs.com/image.jpg', 'https://example.com/image.jpg',
                    'https://user:pass@i.discogs.com/image.jpg', 'https://i.discogs.com:444/image.jpg',
                    'https://i.discogs.com/image.jpg#fragment'):
            with self.subTest(url=url), tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
                output = Path(directory); manifest = {'images': [], 'errors': []}
                item = {'sourceId': 'discogs:2485482:0', 'provider': 'Discogs', 'sourceUrl': url}
                with patch.object(self.script, 'request', return_value=(png_pixel(), url)) as transport:
                    self.script.download_image(item, output, 'image', manifest)
                self.assertEqual(item['status'], 'failed')
                self.assertTrue(manifest['errors'])
                self.assertEqual(transport.call_count, 0)
                self.assertEqual(list(output.iterdir()), [])

    def test_discogs_redirects_stay_https_on_the_original_host(self):
        redirect = getattr(self.script, 'SourceRedirect', urllib.request.HTTPRedirectHandler)()
        for start in ('https://i.discogs.com/a.jpg', 'https://api.discogs.com/releases/2485482'):
            request = urllib.request.Request(start)
            for target in ('http://i.discogs.com/b.jpg', 'https://example.com/b.jpg',
                           'https://user:pass@i.discogs.com/b.jpg', 'https://i.discogs.com:444/b.jpg'):
                with self.subTest(start=start, target=target), self.assertRaises(ValueError):
                    redirect.redirect_request(request, None, 302, 'Found', {}, target)
            same_host = start + '?revision=1'
            self.assertEqual(redirect.redirect_request(request, None, 302, 'Found', {}, same_host).full_url, same_host)
        with self.assertRaises(ValueError):
            redirect.redirect_request(urllib.request.Request('https://api.discogs.com/releases/2485482'), None, 302, 'Found', {}, 'https://i.discogs.com/a.jpg')

    def test_truncated_image_is_failed_and_makes_manifest_partial(self):
        mb = reference_release(); mb['relations'] = []
        def request(url):
            value = {'images': [{'id': 456, 'types': ['Front']}]} if url.endswith('/' + RID) else mb
            return (b'\xff\xd8\xff' if url.endswith('.jpg') else json.dumps(value).encode()), url
        with tempfile.TemporaryDirectory() as directory, patch.object(self.script, 'request', side_effect=request), contextlib.redirect_stdout(io.StringIO()):
            output = Path(directory) / 'reference'
            result = self.script.fetch(RID, output)
            saved = json.loads((output / 'manifest.json').read_text())
        self.assertEqual(result['status'], 'partial')
        self.assertEqual(saved['images'][0]['status'], 'failed')
        self.assertTrue(saved['errors'])

    def test_malformed_discogs_reference_preserves_retrieved_caa_evidence(self):
        for malformed in ([None], None, {'type': 'Barcode', 'value': '4988013047105'}):
            with self.subTest(identifiers=malformed), tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
                mb = reference_release(); reference = reference_discogs(); reference['identifiers'] = malformed
                def request(url):
                    if url.endswith('.jpg'): return png_pixel(), url
                    value = reference if 'api.discogs.com' in url else {'images': [{'id': 456, 'types': ['Front']}]} if 'coverartarchive.org' in url else mb
                    return json.dumps(value).encode(), url
                output = Path(directory) / 'reference'
                with patch.object(self.script, 'request', side_effect=request):
                    try: result = self.script.fetch(RID, output)
                    except Exception as error: self.fail(f'Optional reference must preserve CAA evidence: {error!r}')
                self.assertEqual(result['status'], 'partial')
                saved = json.loads((output / 'manifest.json').read_text())
                self.assertEqual(saved['images'][0]['status'], 'downloaded')
                self.assertEqual(saved['images'][0]['pixels'], [1, 1])
                self.assertEqual(saved['discogs'][0]['status'], 'failed')
                self.assertTrue(saved['errors'])


if __name__ == '__main__': unittest.main()
