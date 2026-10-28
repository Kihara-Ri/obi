"""发送模型的资料白名单；采购、渠道、私人备注及数字实体不进入请求。"""
import json

RELEASE_KEYS = ('catalogNumber', 'barcode', 'label', 'country', 'releaseDate', 'edition',
                'packaging', 'format', 'discCount', 'matrix', 'extras', 'observations',
                'musicBrainzReleaseId', 'discogsReleaseId', 'manualRelease', 'unofficial',
                'tracklist', 'media')


def public_context(record):
    release = record.get('releaseInfo') or {}
    copy = {key: record[key] for key in ('version', 'pressing', 'obi', 'condition') if record.get(key)}
    packaging = record.get('packaging') or {}
    physical = {key: packaging[key] for key in ('structure', 'thickness', 'panels', 'tray', 'finish', 'discs', 'miniLP', 'slipcase')
                if key in packaging}
    if physical: copy['packaging'] = physical
    return {'album': {key: record.get(key, '') for key in ('title', 'artist', 'releaseYear')},
            'release': {key: release[key] for key in RELEASE_KEYS if release.get(key)}, 'copy': copy}


def context_text(record):
    return json.dumps(public_context(record), ensure_ascii=False)
