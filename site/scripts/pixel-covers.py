#!/usr/bin/env python3
"""按 site/cover-wall.json 把封面墙的唱片封面转成像素图（D-044）。

清单 site/cover-wall.json 是唯一要手改的地方：
- size / colors：像素格数与每张保留的颜色数（越大越细）；
- albums：顺序就是上墙顺序（轮流分到三列）；每项 id（输出文件名）、title、artist、
  cover（图片网址，或相对 site/ 的本地路径）、show（false 时留在清单里但不上墙）。

做法参考 me.api 唱机的 pixelCover：高质量缩小 → 反锐化把细线拉开 → 中位切分量化。
页面上用 image-rendering:pixelated 放大，每个像素都是清楚的方块。
原图只缓存在 site/.cover-cache/（不进仓库），提交的是 public/covers/*.png 与 src/covers.json。

用法：python3 site/scripts/pixel-covers.py   需要 Pillow；只在开发机上运行。
"""
import hashlib
import json
import urllib.request
from pathlib import Path

from PIL import Image, ImageFilter

SITE = Path(__file__).resolve().parents[1]
LIST = SITE / 'cover-wall.json'
CACHE = SITE / '.cover-cache'
OUT = SITE / 'public' / 'covers'
MANIFEST = SITE / 'src' / 'covers.json'


def original(cover: str) -> Path:
    if not cover.startswith(('http://', 'https://')):
        return (SITE / cover).resolve()
    CACHE.mkdir(exist_ok=True)
    path = CACHE / (hashlib.sha1(cover.encode()).hexdigest()[:16] + '.img')
    if not path.is_file():
        req = urllib.request.Request(cover, headers={'User-Agent': 'obi-site-covers'})
        with urllib.request.urlopen(req, timeout=30) as res:
            path.write_bytes(res.read())
    return path


def pixelate(img: Image.Image, size: int, colors: int) -> Image.Image:
    img = img.convert('RGB')
    w, h = img.size
    side = min(w, h)  # 原图不是正方形时取中间的正方形，不留黑边
    img = img.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
    small = img.resize((size, size), Image.Resampling.LANCZOS)
    small = small.filter(ImageFilter.UnsharpMask(radius=1, percent=80, threshold=2))
    return small.quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')


def main() -> None:
    conf = json.loads(LIST.read_text(encoding='utf-8'))
    size, colors = int(conf['size']), int(conf['colors'])
    shown = [a for a in conf['albums'] if a.get('show', True)]
    ids = [a['id'] for a in shown]
    if len(ids) != len(set(ids)):
        raise SystemExit('✗ cover-wall.json 里有重复的 id')

    images, missing = {}, []
    for a in shown:
        try:
            path = original(a['cover'])
            images[a['id']] = Image.open(path) if path.is_file() else None
        except Exception as e:  # 网络或格式问题：一并报出来
            images[a['id']] = None
            print(f'  {a["id"]}: {e}')
        if images[a['id']] is None:
            missing.append(f'{a["id"]}  {a["cover"]}')
    if missing:
        raise SystemExit('✗ 取不到这些封面原图：\n  ' + '\n  '.join(missing))

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.png'):
        old.unlink()
    covers = []
    for a in shown:
        pixelate(images[a['id']], size, colors).save(OUT / f'{a["id"]}.png', optimize=True)
        covers.append({'file': f'{a["id"]}.png', 'title': a['title'], 'artist': a['artist']})
    MANIFEST.write_text(json.dumps({'size': size, 'covers': covers}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    hidden = len(conf['albums']) - len(shown)
    print(f'✓ {len(covers)} 张上墙（{size}×{size}，{colors} 色）' + (f'，{hidden} 张隐藏' if hidden else ''))


if __name__ == '__main__':
    main()
