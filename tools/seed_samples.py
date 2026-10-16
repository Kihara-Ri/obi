#!/usr/bin/env python3
"""固定测试样本库：向指定的空数据目录灌入同一组脱敏样本，供浏览器验收与手动测试复用。

后续涉及专辑场景的测试统一复用这里的样本定义和初始化入口；
场景缺口先扩本样本库、可复用素材/初始化方法及 tests/test_sample_library.py，
再运行验证。不要另造测试专辑，也不要在一次性脚本中临时补造贴图或发布任务。

    python3 tools/seed_samples.py --data-dir /tmp/diedu-samples --fetch-covers
    python3 tools/seed_samples.py --data-dir /tmp/diedu-samples --fetch-covers --with-reference-models
    python3 tools/seed_samples.py --export-engine-fixtures /tmp/album-engine-fixtures
    python3 app.py --port 8791 --data-dir /tmp/diedu-samples --no-seed

脱敏边界：样本骨架取自真实收藏的结构特征（日版/侧标、多副本、日元/人民币、
在途/售出中/已售/回收站、新式包装资料），但金额、日期、渠道、订单号、备注、
存放位置全部为虚构；专辑名与艺人属公开音乐资料。默认不合成任何封面或
模拟实物照片；需要真实资料时运行 tools/fetch_sample_covers.py，
优先使用 iTunes 精确匹配的数字封面，再以 Cover Art Archive 为后备，
不能确认确切发行版本时只使用明确标注来源的作品封面，不伪造内页和盘面。
--with-models 可为现有 lift-fists / loveless / illinois 副本发布合成
双袋 Gatefold / 单口 Card Sleeve / Jewel Case 样本，复用 seed_models() 离线初始化。
纹理为带白边、四色分区的纯代码棋盘格，含裁切与弯纸投影，包装仅供动画及贴图验收，
不代表这些发行版的实物核对结果。模型样本另使用明确虚构的固定发行版 ID，
仅供编辑区已发布任务、来源选择和校准入口验收，不用于查询 MusicBrainz 或认定实物发行版。
这些照片仅写入显式 --with-models 的固定样本，普通样本仍保持缺图。
--with-reference-models 获取已核对的固定 CD 发行版原图，发布有来源的参考模型；
与合成几何模式互斥。映射见 tools/sample_reference_models.py，原图只缓存到样本目录，
不冒充实物照片，不进入仓库；失败保留原任务，不使用棋盘补面。
--export-engine-fixtures 只导出这三种合成实体、相同棋盘 PNG 与原始 RGBA 像素，
不创建数据库或任务；独立引擎和 Studio 使用同一组样本定义。

安全约束：只能写入 --data-dir 指定的目录；拒绝指向仓库 data/，拒绝覆盖已存在
且非样本库的 albums.sqlite3；已灌过的目录幂等跳过。写入全部走 storage.py 的
既有事务方法（save/bulk/ship/sell/sale_action/change_showcase_groups），
汇率用内置假汇率（离线确定值），不发网络请求。
"""
import argparse
import base64
import json
import struct
import sqlite3
import sys
import zlib
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from rates import RateService  # noqa: E402
from storage import Store, uid  # noqa: E402

# 每 100 日元兑人民币的假汇率（离线确定值）：07 月 4.75 / 08 月 4.72 / 09 月 4.70。
# 利润等精确断言依赖这些值，改动须同步 tests/test_sample_library.py。
FIXED_RATES = {'2026-07-01': '4.75', '2026-08-01': '4.72', '2026-09-01': '4.70'}


def fake_fetch(start, end):
    return dict(FIXED_RATES)


def open_store(data_dir):
    """按样本库约定打开 Store（假汇率、离线）；seed 与测试共用。"""
    data = Path(data_dir)
    rates = RateService(data / 'rates.sqlite3', fetch=fake_fetch)
    return Store(data / 'albums.sqlite3', rates)


# ── 样本清单（21 副本 / 19 专辑；金额、日期、渠道、备注均为虚构）──────────────
# 每条 (键名, 记录)。键名仅脚本与测试内部引用。
RECORDS = [
    # 国内库存 domestic（8）
    ('dookie-jp', dict(title='Dookie', artist='Green Day', currency='JPY', price='220',
                       date='2026-07-05', location='示例唱片行·A 店', version='Jewel Case',
                       pressing='日版', status='domestic')),
    ('parachutes', dict(title='Parachutes', artist='Coldplay', currency='JPY', price='380',
                        date='2026-07-05', location='示例唱片行·A 店', version='Jewel Case',
                        pressing='日版', obi='带侧标', releaseYear='2000', status='domestic',
                        storage='示例书架·A-1', noteAlbum='示例专辑笔记：与外版副本共享')),
    ('ex-all-time', dict(title='EX All Time Favourites', artist='关淑怡', currency='CNY',
                         price='121', date='2026-07-12', location='示例二手平台',
                         version='Digipak', status='domestic')),
    ('larks', dict(title="Larks' Tongues in Aspic", artist='King Crimson', currency='JPY',
                   price='1210', fees='35', date='2026-07-18', location='示例唱片行·B 店',
                   version='Mini LP Sleeve', pressing='日版', obi='带侧标', condition='近全新',
                   status='domestic')),
    ('minecraft', dict(title='Minecraft: Volume Alpha', artist='C418', currency='JPY',
                       price='', date='2026-07-18', location='示例唱片行·B 店',
                       version='Digipak', status='domestic', note='示例：成本未知（null，不当 0）')),
    ('shall-we', dict(title='Shall We Dance? Shall We Talk!', artist='陈奕迅', currency='CNY',
                      price='138', date='2026-07-25', location='示例二手平台', version='Rigid Box',
                      status='domestic')),
    ('illinois', dict(title='Illinois', artist='Sufjan Stevens', currency='JPY', price='2800',
                      date='2026-08-02', location='示例唱片行·A 店', version='Jewel Case',
                      status='domestic',
                      packaging={'structure': 'jewel', 'thickness': 'standard', 'tray': 'clear',
                                 'discs': 1, 'finish': 'matte'})),
    # 本副本包装/图片在现场核对；不把网上发行版资料冒充样本实物。
    ('islands-jp', dict(title='Islands', artist='King Crimson', currency='JPY', price='',
                        date='2026-08-08', location='示例唱片行·A 店', version='Mini LP Sleeve',
                        pressing='日版', status='domestic',
                        note='示例：从实物条形码核对 Mini LP 包装，成本未知')),
    # 海外库存 overseas（5）
    ('dookie-en', dict(title='Dookie', artist='Green Day', currency='JPY', price='300',
                       date='2026-08-02', location='示例唱片行·C 店', version='Jewel Case',
                       pressing='外版', status='overseas')),
    ('loveless', dict(title='Loveless', artist='My Bloody Valentine', currency='JPY',
                      price='1500', date='2026-08-08', location='示例唱片行·C 店',
                      version='Card Sleeve', pressing='外版', status='overseas')),
    ('tasogare', dict(title='盗作', artist='ヨルシカ', currency='JPY', price='1980',
                      date='2026-08-08', location='示例唱片行·C 店', version='Jewel Case',
                      status='overseas')),
    ('tpab', dict(title='To Pimp a Butterfly', artist='Kendrick Lamar', currency='JPY',
                  price='1700', date='2026-08-15', location='示例唱片行·B 店', version='Jewel Case',
                  pressing='日版', obi='带侧标', status='overseas')),
    ('lift-fists', dict(title='Lift Your Skinny Fists Like Antennas to Heaven',
                        artist='Godspeed You! Black Emperor', currency='JPY', price='2860',
                        date='2026-08-08', location='示例唱片行·C 店', version='Gatefold Sleeve',
                        status='overseas')),
    # 在途 transit（3，同一条包裹，运费按 3 副本分摊）
    ('yehui', dict(title='叶惠美', artist='周杰伦', currency='JPY', price='4000',
                   date='2026-08-15', location='示例代购', version='Jewel Case',
                   pressing='日版', obi='带侧标', status='overseas')),
    ('mbdtf', dict(title='My Beautiful Dark Twisted Fantasy', artist='Kanye West',
                   currency='JPY', price='1100', date='2026-08-15', location='示例代购',
                   version='Jewel Case', pressing='日版', obi='带侧标', status='overseas')),
    ('avici', dict(title='Avīci (01)', artist='Avicii', currency='JPY', price='900',
                   date='2026-08-15', location='示例代购', version='Digipak',
                   status='overseas')),
    # 售出中 shipping（1，上架 + 买家未确认收货）
    ('m83', dict(title="Hurry Up, We're Dreaming.", artist='M83.', currency='JPY',
                 price='680', date='2026-08-22', location='示例唱片行·B 店', version='Digipak',
                 status='domestic')),
    # 已售 sold（3，同一笔 JPY 订单，成交价/扣费/运费按 3 副本分摊）
    ('illinois-en', dict(title='Illinois', artist='Sufjan Stevens', currency='JPY',
                         price='2600', date='2026-08-08', location='示例唱片行·C 店',
                         version='Jewel Case', pressing='外版', status='overseas')),
    ('remain', dict(title='Remain in Light', artist='Talking Heads', currency='JPY',
                    price='1050', date='2026-08-22', location='示例唱片行·C 店',
                    version='Jewel Case', pressing='外版', status='overseas')),
    ('moon', dict(title='A Moon Shaped Pool', artist='Radiohead', currency='JPY', price='',
                  date='2026-08-22', location='示例唱片行·C 店', version='Jewel Case',
                  status='overseas', note='示例：成本未知，利润不计入')),
    # 回收站 trash（1）
    ('first-love', dict(title='First Love', artist='宇多田ヒカル', currency='JPY', price='220',
                        date='2026-07-25', location='示例唱片行·A 店', version='Jewel Case',
                        status='domestic')),
]


def check_target(data_dir):
    """返回 True 表示可以灌入；False 表示已是样本库（幂等跳过）。目标异常直接退出。"""
    target = Path(data_dir).resolve()
    repo_data = (ROOT / 'data').resolve()
    if target == repo_data or repo_data in target.parents:
        raise SystemExit('拒绝写入仓库 data/（真实数据目录）；请换 /tmp 等临时目录')
    db_file = target / 'albums.sqlite3'
    if not db_file.exists():
        return True
    try:
        con = sqlite3.connect(f'file:{db_file}?mode=ro', uri=True)
        try:
            row = con.execute("SELECT data FROM meta WHERE key='sample-seeded'").fetchone()
        finally:
            con.close()
    except sqlite3.Error:
        raise SystemExit(f'{db_file} 已存在且不是样本库；请换一个空目录')
    if row:
        return False
    raise SystemExit(f'{db_file} 已存在且不是样本库；请换一个空目录')


def seed(data_dir):
    """灌入固定样本库；返回 {键名: 记录ID}。已灌过的目录幂等跳过（返回已存 ID）。"""
    if not check_target(data_dir):
        ids = existing_ids(data_dir)
        return ids
    store = open_store(data_dir)
    store.set_modules({'acquisition': True, 'trading': True, 'circulation': True,
                       'showcase': True})
    result = store.save({'items': [dict(item) for _, item in RECORDS]})
    ids = {key: rid for (key, _), rid in zip(RECORDS, result['ids'])}

    # 售出中：上架（带渠道/链接/描述）→ 成交，停在买家未确认收货
    store.bulk({'ids': [ids['m83']], 'action': 'list',
                'listing': {'channel': '示例二手平台', 'url': 'https://example.com/listing/1001',
                            'description': '示例上架描述：全程箱装，碟面无划痕。'}})
    store.sell({'ids': [ids['m83']], 'currency': 'CNY', 'gross': '88.00', 'fees': '4.40',
                'date': '2026-09-05', 'channel': '示例二手平台', 'orderId': 'DEMO-1001',
                'note': '示例：售出中（买家未确认收货）'})

    # 在途：3 副本一条 JPY 包裹，运费分摊带尾差（2249 ÷ 3）
    store.ship({'ids': [ids['yehui'], ids['mbdtf'], ids['avici']], 'currency': 'JPY',
                'cost': '2249', 'method': 'EMS', 'date': '2026-08-20', 'note': '示例在途包裹'})

    # 已售：3 副本一笔 JPY 订单，确认收货到账
    sale = store.sell({'ids': [ids['illinois-en'], ids['remain'], ids['moon']],
                       'currency': 'JPY', 'gross': '12800', 'fees': '640', 'postage': '900',
                       'date': '2026-09-18', 'channel': '示例二手平台', 'orderId': 'DEMO-1002',
                       'note': '示例：已确认收货'})
    store.sale_action({'id': sale['id'], 'action': 'receive', 'date': '2026-09-20'})

    # 回收站
    store.bulk({'ids': [ids['first-love']], 'action': 'delete'})

    # 收藏展示手动组：组内顺序即展示顺序
    store.change_showcase_groups({'action': 'create', 'expectedRevision': 0, 'name': '示例精选',
                                  'recordIds': [ids['parachutes'], ids['tasogare'],
                                                ids['loveless']]})

    with store.connect() as db:
        db.execute("INSERT OR REPLACE INTO meta VALUES('sample-seeded','true')")
    return ids



def existing_ids(data_dir):
    """已灌过的样本库：按（专辑、艺人、价格）唯一匹配出键名 → 记录ID（幂等复用）。

    多副本样本（Dookie、Illinois）价格各不相同，组合键在全库唯一；
    不按状态匹配——样本灌入后状态会被后续操作改写。
    """
    store = open_store(data_dir)
    index = {}
    for r in store.state()['records']:
        index[(r['title'], r['artist'], Decimal(r['price'] or 0))] = r['id']
    ids = {}
    for key, item in RECORDS:
        rid = index.get((item['title'], item['artist'], Decimal(item['price'] or 0)))
        if rid is None:
            raise SystemExit('样本库内容与清单不符；请换一个空目录重新灌入')
        ids[key] = rid
    return ids


MODEL_SAMPLES = {
    'lift-fists': {'structure': 'gatefold', 'panels': 2, 'holder': 'pocket',
                   'pockets': 'both', 'pocketOpening': 'inner', 'discs': 2},
    'loveless': {'structure': 'card-sleeve', 'discs': 1},
    'illinois': {'structure': 'jewel', 'tray': 'clear', 'discs': 1},
}

# Deliberately synthetic identities, never external catalog evidence or lookups.
MODEL_SAMPLE_RELEASES = {
    'lift-fists': '00000000-0000-4000-8000-000000000001',
    'loveless': '00000000-0000-4000-8000-000000000002',
    'illinois': '00000000-0000-4000-8000-000000000003',
}

# One scan contains four different printed planes and an unprinted border.
MODEL_SAMPLE_REGIONS = {
    'front': [.0625, .0625, .5, .0625, .5, .5, .0625, .5],
    'back': [.5, .0625, .9375, .0625, .9375, .5, .5, .5],
    'insideLeft': [.0625, .5, .5, .5, .5, .9375, .0625, .9375],
    'insideRight': [.5, .5, .9375, .5, .9375, .9375, .5, .9375],
}
MODEL_SAMPLE_WARP = [[.5, .5, .9375, .5], [.51, .72, .92, .74], [.5, .9375, .9375, .9375]]


def model_sample_pixels():
    """Shared scan pixels for image projection tests; four distinct faces."""
    pixels = bytearray()
    colors = [(45, 95, 130), (170, 65, 45), (75, 120, 60), (145, 90, 155)]
    for y in range(128):
        for x in range(128):
            color = (245, 245, 245) if min(x, y, 127 - x, 127 - y) < 8 else colors[(y // 64) * 2 + x // 64]
            light = 12 if (x // 16 + y // 16) % 2 and color[0] != 245 else 0
            pixels.extend((*[n + light for n in color], 255))
    return bytes(pixels)


def model_sample_png():
    """可复用合成棋盘纹理；无网络、无真实照片。"""
    def chunk(kind, raw):
        return struct.pack('>I', len(raw)) + kind + raw + struct.pack('>I', zlib.crc32(kind + raw))
    pixels = model_sample_pixels()
    rows = []
    for y in range(128):
        row = bytearray(b'\x00')
        for x in range(128):
            at = (y * 128 + x) * 4
            row.extend(pixels[at:at + 3])
        rows.append(row)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 128, 128, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b''.join(rows))) + chunk(b'IEND', b''))


def model_sample_disc_png():
    """Single tilted printed disc, deliberately elliptical, for A/B correction tests."""
    import math
    width = height = 240
    pixels = bytearray()
    for y in range(height):
        for x in range(width):
            nx, ny = (x + .5) / width - .5, (y + .5) / height - .5
            distance = math.hypot(nx / .41, ny / .31)
            color = (29, 32, 45) if distance > 1 else (212, 122, 76) if distance > .18 else (245, 240, 231)
            pixels.extend(color)
    def chunk(kind, raw):
        return struct.pack('>I', len(raw)) + kind + raw + struct.pack('>I', zlib.crc32(kind + raw))
    rows = b''.join(b'\x00' + pixels[y * width * 3:(y + 1) * width * 3] for y in range(height))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))


def model_sample_accessory_png(kind):
    """Distinct, synthetic prints for the OBI, booklet and paper inner sleeve.

    They deliberately are not the album cover, so a missing real-world source
    cannot masquerade as an authentic photograph of a different object.
    """
    import math
    width = height = 192
    pixels = bytearray()
    for y in range(height):
        v = y / height
        for x in range(width):
            u = x / width
            if kind == 'obi':
                # Three continuous wrap zones: front / narrow spine / back.
                spine = .36 < u < .60
                bg = (35, 67, 82) if spine else (225, 208, 156)
                line = (v < .14 or .25 < v < .265 or .72 < v < .735)
                color = (238, 230, 209) if spine and line else (88, 57, 39) if line else bg
            elif kind == 'booklet':
                bg = (234, 222, 194)
                bands = .14 < v < .18 or .73 < v < .77
                strokes = .20 < u < .76 and any(abs(v - (.30 + j * .066)) < .004 for j in range(6))
                color = (59, 86, 84) if bands or strokes else bg
            else:
                distance = math.hypot((u - .5) * 1.3, (v - .5) * 1.3)
                color = (57, 92, 104) if .36 < distance < .40 else (
                    (208, 202, 181) if u < .055 or v > .94 else (244, 239, 224))
            pixels.extend(color)
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))
    rows = b''.join(b'\x00' + pixels[y * width * 3:(y + 1) * width * 3] for y in range(height))
    return (b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))


def model_sample_surfaces(asset):
    """数据库样本与独立引擎共用的逐面映射，资产名由使用方指定。"""
    roles = ('front', 'back', 'insideLeft', 'insideRight', 'disc', 'disc2')
    return {role: {'asset': asset, 'origin': 'synthetic-sample', 'sourceUrl': '',
                   **({'region': MODEL_SAMPLE_REGIONS[role]} if role in MODEL_SAMPLE_REGIONS else {}),
                   **({'warpRows': MODEL_SAMPLE_WARP} if role == 'insideRight' else {})}
            for role in roles}


def engine_model_variants():
    """All shipped base rigs, using only this library's fictional scan and packaging.

    These are geometry fixtures, not additional ledger copies or edition evidence.
    """
    from vendor.album_engine.document import model_contract, compile_document
    variants = []
    for name in model_contract()['models']:
        if name.startswith(('jewel', 'slimline')):
            package = {'structure': 'jewel', 'discs': 4 if '4' in name else 2 if '2' in name else 1,
                       'thickness': 'slim' if name.startswith('slimline') else 'thick' if name == 'jewel-fat' else 'standard'}
        elif name.startswith(('gatefold', 'digipak')):
            package = {'structure': name.split('-')[0], 'panels': int(name.split('-')[1]),
                       'holder': 'pocket' if name.startswith('gatefold') else 'tray',
                       'pockets': 'both', 'discs': int(name.split('-')[1]),
                       'pocketOpening': 'inner' if name.endswith('inner') else 'outer'}
            if name.endswith('mini-lp'): package['miniLP'] = True
        else:
            package = {'structure': 'card-sleeve' if 'sleeve' in name else name, 'discs': 1}
            if name == 'mini-lp-sleeve': package['miniLP'] = True
        surfaces = model_sample_surfaces('sample-scan.png')
        for role in ('insideCenter', 'insideExtra', 'disc3', 'disc4'):
            surfaces[role] = {'asset': 'sample-scan.png', 'origin': 'synthetic-sample', 'sourceUrl': ''}
        item = {'schemaVersion': 1, 'key': 'rig-' + name, 'title': '合成包装样本 · ' + name,
                'packaging': package, 'surfaces': surfaces}
        if name == 'gatefold-2-mini-lp':
            item['calibration'] = {'spine': {'widthRatio': .035, 'basis': 'image-estimate',
                'asset': 'sample-scan.png', 'origin': 'synthetic-sample', 'sourceUrl': ''}}
        if name in ('gatefold-2-inner','jewel-case'):
            item['components']=[{'id':'synthetic-foldout','kind':'booklet','asset':'sample-booklet.png',
                'origin':'synthetic-sample','sourceUrl':'','fold':{'pattern':'accordion','panels':4 if name=='gatefold-2-inner' else 6},
                'back':{'asset':'sample-booklet.png','origin':'synthetic-sample','sourceUrl':''}}]
        item['document'] = compile_document(item, item['key'], item['title'])
        variants.append(item)
    return variants


def export_engine_fixtures(directory):
    """导出无数据库的固定合成样本；可重复生成，不读写任何收藏资料。"""
    target = Path(directory).resolve()
    repo_data = (ROOT / 'data').resolve()
    if target == repo_data or repo_data in target.parents:
        raise SystemExit('拒绝写入仓库 data/（真实数据目录）；请换样本导出目录')
    titles = {key: record['title'] for key, record in RECORDS}
    entities = [{'schemaVersion': 1, 'key': key, 'title': titles[key],
                 'packaging': dict(packaging), 'surfaces': model_sample_surfaces('sample-scan.png')}
                for key, packaging in MODEL_SAMPLES.items()]
    # A single disc is oblique, while the surrounding synthetic spread stays unchanged.
    entities[0]['surfaces']['disc']['asset'] = 'sample-disc.png'
    # Synthetic book/obi parts exercise independent geometry and controls; no claim about the original album.
    entities[0]['components'] = [
        {'id':'synthetic-obi','kind':'obi','asset':'sample-obi.png','origin':'synthetic-sample','sourceUrl':''},
        {'id':'synthetic-booklet','kind':'booklet','asset':'sample-booklet.png','origin':'synthetic-sample','sourceUrl':''},
        {'id':'synthetic-inner','kind':'inner-sleeve','asset':'sample-inner-sleeve.png','origin':'synthetic-sample','sourceUrl':''},
    ]
    from vendor.album_engine import compile_document
    for entity in entities:
        entity['document'] = compile_document(entity, entity['key'], entity['title'])
    target.mkdir(parents=True, exist_ok=True)
    (target / 'sample-disc.png').write_bytes(model_sample_disc_png())
    for kind in ('obi', 'booklet', 'inner-sleeve'):
        (target / ('sample-' + kind + '.png')).write_bytes(model_sample_accessory_png(kind))
    (target / 'entities.json').write_text(json.dumps(entities, ensure_ascii=False, indent=2) + '\n',
                                         encoding='utf-8')
    (target / 'model-variants.json').write_text(json.dumps(engine_model_variants(), ensure_ascii=False, indent=2) + '\n',
                                              encoding='utf-8')
    (target / 'sample-scan.png').write_bytes(model_sample_png())
    pixels = {'width': 128, 'height': 128, 'channels': 4, 'pixels': list(model_sample_pixels())}
    (target / 'pixels.json').write_text(json.dumps(pixels, separators=(',', ':')) + '\n',
                                       encoding='utf-8')
    return entities


def model_sample_catalog_artwork(key, job):
    """Offline browser catalog response, explicitly synthetic, never source evidence."""
    return {'id': MODEL_SAMPLE_RELEASES[key], 'source': 'synthetic-sample', 'artwork': [
        {'id': 'synthetic-scan', 'types': ['合成测试图（非发行版证据）'],
         'thumbnail': '/api/twin-assets/' + job['id'] + '/photo-0.png'}]}


def seed_models(data_dir):
    """只给固定样本发布离线合成模型；默认 seed 不生成任务，重复调用幂等。"""
    ids = seed(data_dir)
    store = open_store(data_dir)
    records = {r['id']: r for r in store.state()['records']}
    for key, packaging in MODEL_SAMPLES.items():
        rid = ids[key]
        if rid in store.twin_index()['jobs']:
            continue
        # Only --with-models introduces fictional catalog bindings. The ordinary
        # 21-copy sample library keeps all absence/provenance states unchanged.
        release_info = dict(records[rid].get('releaseInfo') or {})
        release_info['musicBrainzReleaseId'] = MODEL_SAMPLE_RELEASES[key]
        originals = [model_sample_png()]
        if key == 'lift-fists':
            originals += [model_sample_disc_png()] + [model_sample_accessory_png(kind) for kind in ('obi','booklet','inner-sleeve')]
        store.save({'id':rid,'revision':records[rid]['revision'], 'releaseInfo':release_info,
                    'photos':['data:image/png;base64,' + base64.b64encode(raw).decode() for raw in originals]})
        records[rid] = next(record for record in store.state()['records'] if record['id'] == rid)
        job = store.start_twin({'recordId': rid, 'recordRevision': records[rid]['revision'],
                                'requestId': uid()})['job']
        claimed = store.claim_twin('sample-library')
        assert claimed['id'] == job['id']
        store.write_twin_source(job['id'], claimed['claim'], 'photo-0.png', model_sample_png())
        surfaces = model_sample_surfaces('photo-0.png')
        if key == 'lift-fists':
            store.write_twin_source(job['id'], claimed['claim'], 'photo-1.png', model_sample_disc_png())
            surfaces['disc']['asset'] = 'photo-1.png'
        entity = {'packaging': dict(packaging),
                  'surfaces': surfaces}
        if key == 'lift-fists':
            entity['components'] = []
            for number, kind, component_id in [(2, 'obi', 'synthetic-obi'),
                                                (3, 'booklet', 'synthetic-booklet'),
                                                (4, 'inner-sleeve', 'synthetic-inner')]:
                filename = 'photo-' + str(number) + '.png'
                store.write_twin_source(job['id'], claimed['claim'], filename, model_sample_accessory_png(kind))
                entity['components'].append({'id': component_id, 'kind': kind, 'asset': filename,
                                             'origin': 'synthetic-sample', 'sourceUrl': ''})
        store.update_twin(job['id'], claimed['claim'], status='succeeded', phase='published',
                          message='合成模型样本：仅用于动画验收，未核对实物发行版',
                          releaseId=MODEL_SAMPLE_RELEASES[key], entity=entity)
    jobs = store.twin_index()['jobs']
    artwork = {MODEL_SAMPLE_RELEASES[key]: model_sample_catalog_artwork(key, jobs[ids[key]]) for key in MODEL_SAMPLES}
    (Path(data_dir) / 'sample-catalog-artwork.json').write_text(json.dumps(artwork, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return ids


def main():
    p = argparse.ArgumentParser(description='灌入固定测试样本库')
    target = p.add_mutually_exclusive_group(required=True)
    target.add_argument('--data-dir', help='目标数据目录（须为空目录或已灌过的样本库）')
    target.add_argument('--export-engine-fixtures', help='只导出固定合成实体及纹理，不创建数据库')
    models = p.add_mutually_exclusive_group()
    models.add_argument('--with-models', action='store_true', help='仅引擎专项测试：发布合成 3D 几何/纹理模型，普通样本不会生成')
    models.add_argument('--with-reference-models', action='store_true', help='展示验收：获取同版真实图集并发布参考 3D（需要联网）')
    p.add_argument('--reference-cache', help='复用已冻结的发行版图集目录，仅用于 --with-reference-models')
    p.add_argument('--fetch-covers', action='store_true',
                   help='优先 iTunes 精确匹配的数字封面，CAA 后备（需要联网）')
    args = p.parse_args()
    if args.reference_cache and not args.with_reference_models:
        p.error('--reference-cache 须与 --with-reference-models 一起使用')
    if args.export_engine_fixtures:
        entities = export_engine_fixtures(args.export_engine_fixtures)
        print(f'固定引擎样本已导出：{Path(args.export_engine_fixtures).resolve()}（{len(entities)} 实体）')
        return
    ids = seed_models(args.data_dir) if args.with_models else seed(args.data_dir)
    if args.fetch_covers:
        from tools.fetch_sample_covers import run as fetch_real_cover_art
        fetch_real_cover_art(args.data_dir)
    if args.with_reference_models:
        from tools.seed_reference_models import run as publish_reference_models
        publish_reference_models(args.data_dir, args.reference_cache)
    print(f'固定样本库已就绪：{Path(args.data_dir).resolve()}（{len(ids)} 副本）')
    print('启动：python3 app.py --port <空闲端口> --data-dir '
          f'{Path(args.data_dir).resolve()} --no-seed')


if __name__ == '__main__':
    main()
