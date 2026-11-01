"""Private, short-lived photo staging; no ledger writes until Store.save()."""
import os
import re
import tempfile
import time
from pathlib import Path

from domain import ValidationError

MAX_BYTES = 8 * 1024 * 1024
TTL = 24 * 60 * 60
TOKEN = re.compile(r'^[0-9a-f]{32}$')


def checked_token(value):
    if not isinstance(value, str) or not TOKEN.fullmatch(value):
        raise ValidationError('照片上传标识无效，请重新添加照片')
    return value


def image_extension(raw):
    if raw.startswith(b'\xff\xd8\xff'): return '.jpg'
    if raw.startswith(b'\x89PNG\r\n\x1a\n'): return '.png'
    if raw[:4] == b'RIFF' and raw[8:12] == b'WEBP': return '.webp'
    raise ValidationError('照片格式不正确，请使用 JPG/PNG/WebP 图片')


def stage(data_dir, source, token):
    token = checked_token(token)
    source = Path(source)
    if not 0 < source.stat().st_size <= MAX_BYTES:
        raise ValidationError('单张照片不能为空或超过 8 MB')
    raw = source.read_bytes()
    image_extension(raw)
    folder = Path(data_dir) / '.photo-uploads'
    folder.mkdir(exist_ok=True)
    # Only this private staging directory is pruned; saved photos are unrelated.
    for old in folder.iterdir():
        if old.is_file() and not old.is_symlink() and old.stat().st_mtime < time.time() - TTL:
            old.unlink()
    target = folder / token
    if target.is_symlink(): raise ValidationError('照片暂存无效')
    if target.exists():
        if target.read_bytes() != raw: raise ValidationError('照片上传标识已被使用，请重新添加照片')
        os.utime(target, None)
    else:
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=folder, prefix='.stage-', delete=False) as f:
                temporary = Path(f.name)
                f.write(raw)
            os.replace(temporary, target)
        finally:
            if temporary is not None: temporary.unlink(missing_ok=True)
    return {'ref': token, 'bytes': len(raw)}


def staged_bytes(data_dir, token):
    target = Path(data_dir) / '.photo-uploads' / checked_token(token)
    if target.is_symlink() or not target.is_file() or target.stat().st_mtime < time.time() - TTL:
        raise ValidationError('照片暂存已过期或不存在，请重新添加这张照片')
    raw = target.read_bytes()
    if not 0 < len(raw) <= MAX_BYTES: raise ValidationError('照片暂存无效，请重新添加照片')
    return image_extension(raw), raw
