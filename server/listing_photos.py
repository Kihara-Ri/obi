"""只读取当前副本照片；共享分析与导出的版本/归属校验。"""
import io
import re
import zipfile

from domain import ValidationError
from domain_listing import photo_order


def listing_record(store, rid):
    if not isinstance(rid, str) or not re.fullmatch(r'[0-9a-f]{32}', rid):
        raise ValidationError('副本编号无效')
    with store.connect() as db:
        store.require_module('trading', db)
        record = store.get(db, 'records', rid)
    if record['status'] not in ('domestic', 'overseas'):
        raise ValidationError('只有库存中的副本可准备售卖资料')
    return record


def read_photos(store, rid, order, revision):
    record = listing_record(store, rid)
    if type(revision) is not int or revision != record.get('photoRevision', 0):
        raise ValidationError('照片已变更，请重新打开并核对')
    order = photo_order(order, record.get('photoCount', 0))
    if not order: raise ValidationError('请先选择实物照片')
    images = []
    total = 0
    for index in order:
        matches = [p for p in (store.photos_dir / rid).glob(f'{index}.*')
                   if p.suffix in ('.jpg', '.png', '.webp') and p.is_file() and not p.is_symlink()]
        if len(matches) != 1: raise ValidationError(f'照片 {index + 1} 缺失，请重新上传')
        path = matches[0]
        if path.stat().st_size > 6 * 1024 * 1024: raise ValidationError('单张照片过大')
        raw = path.read_bytes(); total += len(raw)
        if total > 35 * 1024 * 1024: raise ValidationError('照片总量过大，请减少选择')
        images.append((index, path.suffix, raw))
    if listing_record(store, rid).get('photoRevision', 0) != revision:
        raise ValidationError('照片已变更，请重试')
    return record, images


def photo_archive(store, rid, order, revision):
    _, images = read_photos(store, rid, order, revision)
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED) as archive:
        for position, (_, extension, raw) in enumerate(images, 1):
            archive.writestr(f'{position:02d}{extension}', raw)
    return output.getvalue()
