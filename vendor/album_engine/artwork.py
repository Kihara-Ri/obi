"""Conservative, provenance-preserving alternative-release artwork ranking.

The confirmed edition always owns the album identity, barcode and packaging.
Other editions supply *only* printable artwork, and only when their known
packaging and physical medium are compatible. Do not guess a package from art.
"""


def packaging_family(value):
    text = str(value or '').strip().lower().replace('-', ' ').replace('/', ' ')
    if not text or text in ('none', 'unknown', 'other'):
        return None
    if 'gatefold' in text:
        return 'gatefold'
    if 'digipak' in text:
        return 'digipak'
    if 'digibook' in text:
        return 'digibook'
    if 'jewel' in text:
        return 'jewel'
    if 'cardboard' in text or 'paper sleeve' in text or 'card sleeve' in text:
        return 'card-sleeve'
    if 'box' in text:
        return 'box'
    return None


def compatible_release(candidate, original, original_cd_count):
    """Explicit same physical packaging and same CD count; never vinyl/digital."""
    expected = packaging_family(original.get('packaging'))
    if not expected or packaging_family(candidate.get('packaging')) != expected:
        return False
    media = candidate.get('media')
    if not isinstance(media, list) or len(media) != original_cd_count:
        return False
    return all(isinstance(m, dict) and 'CD' in str(m.get('format', '')).upper()
               and not any(bad in str(m.get('format', '')).upper() for bad in ('DVD', 'VINYL', 'SACD'))
               for m in media)


def image_coverage(images):
    """Role diversity before raw image count; not a claim of print equivalence."""
    if not isinstance(images, list):
        return (0, 0)
    types = {t.casefold() for item in images if isinstance(item, dict)
             for t in item.get('types', []) if isinstance(t, str)}
    roles = ('front', 'back', 'medium', 'booklet', 'spine', 'other')
    return (sum(role in types for role in roles), min(len(images), 40))


def has_sufficient_exact_art(catalog, references):
    """A verified exact-release Discogs booklet can replace a missing CAA set."""
    archive = catalog.get('images', []) if isinstance(catalog, dict) else []
    if image_coverage(archive)[0] >= 3:
        return True
    return any(isinstance(ref, dict) and ref.get('status') == 'verified'
               and len(ref.get('images', [])) >= 6
               for ref in references)
