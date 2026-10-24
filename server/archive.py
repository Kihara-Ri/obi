"""完整备份包：账本 JSON + 数据目录里的图片与实体文件，打成一个 zip（D-026）。

和每日快照（只有账本）不同，这是给用户自己保存、换设备时整份搬过去的东西：
实物照片、自己上传的封面这类丢了就补不回来的文件都在里面。凭据、插件程序与缓存不进包。

包内结构：
  manifest.json   {"format": "album-ledger-archive", "version": 1, "schema", "createdAt", "files": {路径: {size, sha256}}}
  ledger.json     Store.backup() 的完整账本（与旧的 .json 完整备份同格式）
  photos/… covers/… digital-twins/… engine-models/…

恢复：先整包校验并解到数据目录内的暂存目录，账本恢复成功后才替换文件夹；被替换的旧文件夹
移到 backups/pre-restore/（只留最近一次），与账本恢复前的自动快照一起，构成「恢复前先保存当前状态」。
"""
import hashlib
import json
import shutil
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path, PurePosixPath

from domain import ValidationError

FORMAT = 'album-ledger-archive'
VERSION = 1
FOLDERS = ('photos', 'covers', 'digital-twins', 'engine-models')
MAX_FILES = 200_000
MAX_TOTAL = 8 * 1024 ** 3      # 解压后总大小上限：挡住压缩炸弹
MAX_UPLOAD = 4 * 1024 ** 3     # 上传的备份包大小上限
CHUNK = 1024 * 1024


def _sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(CHUNK), b''): h.update(block)
    return h.hexdigest()


def _files(root):
    for folder in FOLDERS:
        base = root / folder
        if not base.is_dir(): continue
        for path in sorted(base.rglob('*')):
            if path.is_file() and not path.is_symlink():
                yield path.relative_to(root).as_posix(), path


def file_name(when=None):
    return f'obi-backup-{(when or datetime.now()).strftime("%Y%m%d-%H%M")}.zip'


def build(store):
    """生成完整备份包，返回 zip 字节。全部按原样存入：图片本身已压缩，再压一遍只费时间。"""
    root = Path(store.path).parent
    ledger = json.dumps(store.backup(), ensure_ascii=False).encode()
    entries = list(_files(root))
    manifest = {'format': FORMAT, 'version': VERSION, 'schema': json.loads(ledger)['schema'],
                'createdAt': datetime.now().isoformat(timespec='seconds'),
                'files': {name: {'size': path.stat().st_size, 'sha256': _sha256(path)} for name, path in entries}}
    with tempfile.SpooledTemporaryFile(max_size=64 * 1024 * 1024) as out:
        with zipfile.ZipFile(out, 'w', zipfile.ZIP_STORED, allowZip64=True) as z:
            # 清单与账本放在最前、不压缩：网页选中文件后可直接读出专辑与交易数给确认框（web/src/core/backup-file.ts）
            z.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=1))
            z.writestr('ledger.json', ledger)
            for name, path in entries: z.write(path, name)
        out.seek(0)
        return out.read()


def _check_name(name):
    p = PurePosixPath(name)
    if (name != p.as_posix() or '\\' in name or p.is_absolute() or '..' in p.parts
            or len(p.parts) < 2 or p.parts[0] not in FOLDERS):
        raise ValidationError(f'备份包含不允许的路径：{name[:80]}')


def _read_json(z, name, limit):
    try: info = z.getinfo(name)
    except KeyError: raise ValidationError(f'备份包缺少 {name}，请选择 Obi 下载的完整备份')
    if info.file_size > limit: raise ValidationError(f'备份包里的 {name} 过大')
    try: return json.loads(z.read(info))
    except ValueError: raise ValidationError(f'备份包里的 {name} 已损坏')


def restore(store, source):
    """从 zip 恢复账本与文件。source 为本地 zip 路径；失败时当前账本与文件都不动。"""
    root = Path(store.path).parent
    try: z = zipfile.ZipFile(source)
    except (zipfile.BadZipFile, OSError): raise ValidationError('不是有效的备份包（zip 已损坏或不完整）')
    with z, tempfile.TemporaryDirectory(prefix='.restore-', dir=root) as temp:
        manifest = _read_json(z, 'manifest.json', 64 * 1024 * 1024)
        if not isinstance(manifest, dict) or manifest.get('format') != FORMAT:
            raise ValidationError('不是 Obi 的完整备份包')
        if not isinstance(manifest.get('version'), int) or manifest['version'] > VERSION:
            raise ValidationError('备份包来自更新版本的 Obi，请先更新应用再恢复')
        listed = manifest.get('files')
        if not isinstance(listed, dict) or len(listed) > MAX_FILES:
            raise ValidationError('备份包的文件清单无效')
        infos = {i.filename: i for i in z.infolist() if not i.is_dir()}
        names = set(infos) - {'manifest.json', 'ledger.json'}
        if names != set(listed): raise ValidationError('备份包内容与清单不符，可能下载不完整')
        if sum(i.file_size for i in infos.values()) > MAX_TOTAL: raise ValidationError('备份包过大')
        ledger = _read_json(z, 'ledger.json', 512 * 1024 * 1024)
        staged = Path(temp)
        for name in sorted(names):
            _check_name(name)
            meta = listed[name]
            if not isinstance(meta, dict) or infos[name].file_size != meta.get('size'):
                raise ValidationError(f'备份包文件大小不符：{name[:80]}')
            target = staged / name
            target.parent.mkdir(parents=True, exist_ok=True)
            h = hashlib.sha256()
            with z.open(infos[name]) as src, open(target, 'wb') as dst:
                for block in iter(lambda: src.read(CHUNK), b''): h.update(block); dst.write(block)
            if h.hexdigest() != meta.get('sha256'): raise ValidationError(f'备份包文件已损坏：{name[:80]}')
        # 账本先恢复（内部会先存一份当前账本快照，校验不过则抛错、文件不动）
        result = store.restore_backup(ledger)
        keep = root / 'backups' / 'pre-restore'
        if keep.exists(): shutil.rmtree(keep)
        keep.mkdir(parents=True)
        for folder in FOLDERS:
            if (root / folder).exists(): shutil.move(str(root / folder), str(keep / folder))
            if (staged / folder).exists(): shutil.move(str(staged / folder), str(root / folder))
    return {**(result or {}), 'files': len(names)}

