"""上架资料包的事实白名单；排除采购、渠道、私人备注和数字实体。"""
from domain import release_medium

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
    # 介质与黑胶规格 / 品相（D-055）：Agent 据此区分黑胶的文案、打包和运费
    copy['medium'] = release_medium(release) or 'cd'
    if copy['medium'] == 'vinyl' and record.get('vinyl'): copy['vinyl'] = dict(record['vinyl'])
    return {'album': {key: record.get(key, '') for key in ('title', 'artist', 'releaseYear')},
            'release': {key: release[key] for key in RELEASE_KEYS if release.get(key)}, 'copy': copy}
