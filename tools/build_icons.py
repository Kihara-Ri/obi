#!/usr/bin/env python3
"""从 static/favicon.svg 同步生成 PWA 图标；开发工具需已安装 ImageMagick。

    python3 tools/build_icons.py

普通图标保留圆角；maskable 使用不透明方形底，卡片仍铺满下半部，
唱片与卡片标记缩入中央安全区，供系统裁切。服务端不依赖此工具。
"""
import shutil
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SVG_NS = 'http://www.w3.org/2000/svg'


def build_icons():
    magick = shutil.which('magick')
    if not magick:
        raise SystemExit('需要已安装的 ImageMagick（magick）来生成图标')
    ET.register_namespace('', SVG_NS)
    source = (ROOT / 'static/favicon.svg').read_bytes()
    for maskable in (False, True):
        svg = ET.fromstring(source)
        if maskable:
            outline = svg.find(f'.//{{{SVG_NS}}}clipPath/{{{SVG_NS}}}rect')
            for element in svg.iter():
                if element is outline or element.get('id') == 'icon-background':
                    element.set('rx', '0')
                if element.get('id') in ('icon-record', 'icon-card-details'):
                    element.set('transform', 'translate(51.2 51.2) scale(.8)')
        artwork = ET.tostring(svg)
        for size in (192, 512):
            suffix = '-maskable' if maskable else ''
            output = ROOT / 'static' / f'icon-{size}{suffix}.png'
            subprocess.run([
                magick, '-density', '288', '-background', 'none', 'svg:-',
                '-resize', f'{size}x{size}', '-strip', f'PNG32:{output}',
            ], input=artwork, check=True)
            print(f'生成 {output.relative_to(ROOT)}')


if __name__ == '__main__':
    build_icons()
