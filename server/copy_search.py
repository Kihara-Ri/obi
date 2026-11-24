"""Match copies by text or a stored release identifier."""
import re

from domain import ValidationError
from .release_merge import _catnos, _code


def lookup_value(by, term):
    if by == 'text':
        return term.casefold().split()
    if by == 'barcode':
        if not re.fullmatch(r'[0-9 -]+', term) or not (value := _code(term)):
            raise ValidationError('请提供有效条码')
        return value
    if by == 'catalogNumber':
        numbers = _catnos(term)
        if len(numbers) != 1:
            raise ValidationError('请提供一个唱片编号')
        return next(iter(numbers))
    raise ValidationError('查找方式无效')


def matches_copy(record, by, value):
    release = record.get('releaseInfo') or {}
    if by == 'barcode':
        return value == _code(release.get('barcode'))
    if by == 'catalogNumber':
        return value in _catnos(release.get('catalogNumber'))
    names = f"{record.get('artist', '')} {record.get('title', '')}".casefold()
    return all(term in names for term in value)
