"""Edition artwork plans for the fixed sample library, never personal copies.

CAA originals and same-edition Discogs scans were visually inspected. Regions
are normalized coordinates in untouched originals; artwork is not redistributed.
The plans are reference demonstrations, not proof of a physical copy's edition.
"""


def quad(left=0, top=0, right=1, bottom=1):
    return [left, top, right, top, right, bottom, left, bottom]


REFERENCE_MODELS = {
    'lift-fists': {
        'releaseId': 'e51e1f8b-62ba-388f-8567-0c051b575351',
        # MB's broad "Digipak" label conflicts with the same-edition notes and
        # scans: Discogs 1130206 explicitly says gatefold sleeve, without trays.
        'packaging': {'structure': 'gatefold', 'panels': 2, 'holder': 'pocket',
                      'pockets': 'both', 'pocketOpening': 'inner', 'discs': 2, 'finish': 'uncoated'},
        'surfaces': {
            'front': {'sourceId': 'caa:35266489179'},
            'back': {'sourceId': 'caa:35266711662'},
            'insideLeft': {'sourceId': 'caa:35266695434'},
            'insideRight': {'sourceId': 'caa:35266703827'},
            'spine': {'sourceId': 'caa:35266725975'},
            'disc': {'sourceId': 'caa:35266741226'},
            'disc2': {'sourceId': 'caa:35266757158'},
        },
        'components': [
            {'id': 'reference-obi', 'kind': 'obi', 'sourceId': 'caa:35266726740'},
            {'id': 'reference-booklet', 'kind': 'booklet', 'sourceId': 'caa:35266496659',
             'fold': {'pattern': 'accordion', 'panels': 4},
             'back': {'sourceId': 'caa:35266576694'}},
        ],
        'evidence': 'https://www.discogs.com/release/1130206',
    },
    'spiderland': {
        'releaseId': '35ff10b7-f69d-47e8-8921-79e0ffd2a51b',
        'packaging': {'structure': 'jewel', 'tray': 'clear', 'discs': 1, 'finish': 'gloss'},
        'surfaces': {
            'front': {'sourceId': 'caa:5946312071'},
            # Back inlay scan carries both spines; the left strip is the spine face.
            'back': {'sourceId': 'caa:23507077901', 'region': quad(.044, 0, .956, 1)},
            'spine': {'sourceId': 'caa:23507077901', 'region': quad(0, 0, .044, 1)},
            'insideLeft': {'sourceId': 'caa:11175263150'},
            'disc': {'sourceId': 'caa:11175262732'},
        },
        'components': [{'id': 'reference-booklet', 'kind': 'booklet', 'sourceId': 'caa:5946312071',
                        'back': {'sourceId': 'caa:11175263150'}}],
        'evidence': 'https://musicbrainz.org/release/35ff10b7-f69d-47e8-8921-79e0ffd2a51b',
    },
    'illinois': {
        'releaseId': '777d51fe-b7c7-4874-9217-40abf09b4924',
        'packaging': {'structure': 'jewel', 'tray': 'clear', 'discs': 1, 'finish': 'matte'},
        'surfaces': {
            'front': {'sourceId': 'caa:12423981101'},
            'back': {'sourceId': 'caa:12424296879', 'region': quad(.042, 0, .958, 1)},
            'spine': {'sourceId': 'caa:12424296879', 'region': quad(0, 0, .042, 1)},
            'insideLeft': {'sourceId': 'caa:12424201614', 'region': quad(0, 0, 1 / 6, 1)},
            'insideRight': {'sourceId': 'caa:12424324535', 'region': quad(.042, 0, .958, 1)},
            'disc': {'sourceId': 'caa:12424422032'},
        },
        # The complete six-panel face is verified; no reverse scan is available.
        'components': [{'id': 'reference-booklet', 'kind': 'booklet', 'sourceId': 'caa:12424201614',
                        'fold': {'pattern': 'accordion', 'panels': 6}}],
        'evidence': 'https://www.discogs.com/release/625723',
    },
}
