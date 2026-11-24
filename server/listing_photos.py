"""资料包与普通照片下载共用原图的版本与归属验证。"""
from contextlib import closing
import io
import re
import zipfile

from domain import ConflictError, ValidationError
from domain_listing import photo_order


def _photo_record(store, rid, stock_only, *, expected_revision=None):
    if not isinstance(rid, str) or not re.fullmatch(r'[0-9a-f]{32}', rid):
        raise ValidationError('副本编号无效')
    with closing(store.connect()) as db, db:
        if stock_only:
            store.require_module('trading', db)
        try:
            record = store.get(db, 'records', rid)
        except ValidationError as error:
            if expected_revision is None:
                raise
            raise ConflictError('副本已变更，请重新获取资料包') from error
    if expected_revision is not None and record['revision'] != expected_revision:
        raise ConflictError('副本已变更，请重新获取资料包')
    if stock_only and record['status'] not in ('domestic', 'overseas'):
        raise ValidationError('只有库存中的副本可准备售卖资料')
    return record


def listing_record(store, rid, *, expected_revision=None):
    return _photo_record(store, rid, stock_only=True, expected_revision=expected_revision)


def read_photos(store, rid, order, revision, *, stock_only=True):
    record = _photo_record(store, rid, stock_only)
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
    if _photo_record(store, rid, stock_only).get('photoRevision', 0) != revision:
        raise ValidationError('照片已变更，请重试')
    return record, images


def file_label(record):
    """文件名里的专辑标识：艺人 - 专辑名；去掉各系统不允许的字符并限长。"""
    def clean(value):
        value = re.sub(r'[\\/:*?"<>|\x00-\x1f]', ' ', str(value or ''))
        return re.sub(r'\s+', ' ', value).strip(' .')[:50]
    return ' - '.join(part for part in (clean(record.get('artist')), clean(record.get('title'))) if part)


def photo_archive(store, rid, order, revision):
    record, images = read_photos(store, rid, order, revision, stock_only=False)
    label = file_label(record)
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED) as archive:
        for position, (_, extension, raw) in enumerate(images, 1):
            archive.writestr(f'{label} - {position:02d}{extension}' if label else f'{position:02d}{extension}', raw)
    return output.getvalue()


def api_photo_archive(h, svc):
    from .routes import WRITE_LOCK, query
    values = query(h)
    try:
        order = [int(i) for i in values.get('order', '').split(',') if i]
        revision = int(values.get('photoRevision', ''))
    except ValueError:
        raise ValidationError('照片选择格式无效') from None
    with WRITE_LOCK:
        raw = photo_archive(svc.store, values.get('id', ''), order, revision)
    h.send(raw, mime='application/zip', filename='album-photos.zip')
