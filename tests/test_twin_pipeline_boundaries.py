"""Offline contract tests of the source → interpretation → assembly boundaries."""
import copy
import unittest

from domain import ValidationError
from server.twin_sources import SourceManifest, SourceDiscovery
from server.twin_surfaces import SurfaceUnderstanding
from server.twin_assembly import GeometryAssembly
from server.twin_errors import NeedsInput


class NoNetwork:
    def __getattr__(self, name):
        raise AssertionError(f'Network call forbidden: {name}')


class NoStore:
    def twin_source(self, *args):
        raise AssertionError('Unexpected disk read')

    def write_twin_source(self, *args):
        raise AssertionError('Unexpected disk write')


class StubVision:
    def __init__(self, plan, build=None):
        self.plan_result = plan
        self.build_result = build or {}
        self.calls = []

    def agent_json(self, system, prompt, visuals=(), on_start=None):
        self.calls.append((prompt[:5], len(visuals)))
        if on_start:
            on_start()
        return self.plan_result if prompt.startswith('PLAN') else self.build_result


def manifest():
    release = {'id': '11111111-1111-4111-8111-111111111111', 'country': 'JP',
               'packaging': 'Cardboard/Paper Sleeve', 'barcode': '4988013047105',
               'media': [{'format': 'CD'}]}
    sources = {'photo:0': {'asset': 'photo-0.png', 'origin': 'record-photo'}}
    return SourceManifest(
        context={'release': release, 'recordSources': list(sources), 'archiveImages': [],
                 'editionReferences': [{'status': 'verified',
                                        'images': [{'sourceId': 'discogs:45:2'}]}],
                 'compatibleArtwork': []},
        sources=sources, catalog_ids={},
        related_ids={}, reference_ids={'discogs:45:2': {
            'sourceId': 'discogs:45:2', 'url': 'https://i.discogs.com/verified.jpg'}},
        edition=release['id']
    )


class PipelineBoundaryTests(unittest.TestCase):
    def test_manifest_only_allows_verified_source_ids(self):
        evidence = manifest()
        self.assertEqual(evidence.allowed_ids, {'photo:0', 'discogs:45:2'})
        # Network is forbidden: invalid model references are rejected before any fetch.
        discovery = SourceDiscovery(NoStore(), NoNetwork(), NoNetwork(), NoNetwork())
        job = {'id': 'a' * 32, 'claim': 'token'}
        with self.assertRaisesRegex(ValidationError, '不存在'):
            discovery.fetch_images(job, evidence, ['https://evil.invalid/pic.jpg'],
                                   lambda *_: None)
        with self.assertRaisesRegex(ValidationError, '不存在'):
            discovery.fetch_images(job, evidence, ['discogs:999:2'],
                                   lambda *_: None)

    def test_visual_planning_cannot_override_verified_manifest(self):
        fake = StubVision({'sourceIds': ['discogs:999:2']})
        vision = SurfaceUnderstanding(fake, NoStore(), 'skill', 'runtime')
        with self.assertRaisesRegex(ValidationError, '不存在'):
            vision.plan(manifest().context, {}, manifest().allowed_ids, lambda *_: None)
        self.assertEqual(fake.calls, [('PLAN ', 0)])

    def test_mandatory_real_photos_survive_visual_selection(self):
        fake = StubVision({'sourceIds': ['discogs:45:2']})
        vision = SurfaceUnderstanding(fake, NoStore(), 'skill', 'runtime')
        selected = vision.plan(manifest().context, {'photos': {'front': 0}},
                               manifest().allowed_ids, lambda *_: None)
        self.assertEqual(selected, ['discogs:45:2', 'photo:0'])

    def test_geometry_assembly_without_model_or_network(self):
        original = manifest()
        release = copy.deepcopy(original.context['release'])
        rid = 'a' * 32
        job = {'input': {'title': 'Sample', 'artist': 'Sample Artist',
                         'packaging': {}}, 'releaseId': release['id'], 'id': rid}
        sources = {
            'discogs:45:2': {'asset': 'discogs-45-2.jpg', 'origin': 'edition-reference',
                             'sourceUrl': 'https://i.discogs.com/verified.jpg'},
            'photo:0': {'asset': 'photo-0.png', 'origin': 'record-photo', 'sourceUrl': ''},
        }
        mapping = {'sameAlbum': True,
                   'packaging': {'structure': 'card-sleeve', 'holder': 'pocket', 'discs': 1},
                   'surfaces': {'front': {'sourceId': 'photo:0'},
                                'back': {'sourceId': 'discogs:45:2'},
                                'disc': {'sourceId': 'discogs:45:2'}}}
        assembly = GeometryAssembly(NoStore())
        before = copy.deepcopy(mapping)
        entity = assembly.assemble(mapping, job, release, sources, 1)
        self.assertEqual(entity['packaging']['structure'], 'card-sleeve')
        self.assertEqual(entity['release']['id'], release['id'])
        self.assertEqual(entity['surfaces']['front']['origin'], 'record-photo')
        self.assertEqual(entity['surfaces']['disc']['origin'], 'edition-reference')
        self.assertEqual(mapping, before, 'assembly must not mutate the preceding stage output')
        # Geometric source binding cannot point outside the verified manifest.
        invalid = copy.deepcopy(mapping)
        invalid['surfaces']['disc']['sourceId'] = 'caa:unverified'
        with self.assertRaises(NeedsInput):
            assembly.assemble(invalid, job, release, sources, 1)
        # No source rewrite changes the published edition identity.
        self.assertEqual(entity['release']['id'], original.edition)

    def test_missing_face_cannot_be_published_even_with_valid_sources(self):
        evidence = manifest()
        assembly = GeometryAssembly(NoStore())
        data = {'sameAlbum': True, 'packaging': {'structure': 'card-sleeve', 'discs': 1},
                'surfaces': {'front': {'sourceId': 'photo:0'},
                             'back': {'sourceId': 'photo:0'}}}
        with self.assertRaisesRegex(NeedsInput, 'disc'):
            assembly.assemble(data, {'input': {'packaging': {}}, 'releaseId': evidence.edition},
                              evidence.context['release'], evidence.sources, 1)


if __name__ == '__main__':
    unittest.main()
