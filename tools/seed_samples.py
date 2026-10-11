#!/usr/bin/env python3
"""固定测试样本库：向指定的空数据目录灌入同一组脱敏样本，供浏览器验收与手动测试复用。

所有验证（浏览器实测、手动点点看）一律用这批样本，不要每次现造测试数据；
样本不变量由 tests/test_sample_library.py 守护，场景缺口先扩这里再扩测试。

    python3 tools/seed_samples.py --data-dir /tmp/diedu-samples
    python3 app.py --port 8791 --data-dir /tmp/diedu-samples --no-seed

脱敏边界：样本骨架取自真实收藏的结构特征（日版/侧标、多副本、日元/人民币、
在途/售出中/已售/回收站、新式包装资料），但金额、日期、渠道、订单号、备注、
存放位置全部为虚构；专辑名与艺人属公开音乐资料。不含照片、封面、条码与
数字实体任务——拍照识别、条码核对这类流程在验证现场用临时照片或手输条码。

安全约束：只能写入 --data-dir 指定的目录；拒绝指向仓库 data/，拒绝覆盖已存在
且非样本库的 albums.sqlite3；已灌过的目录幂等跳过。写入全部走 storage.py 的
既有事务方法（save/bulk/ship/sell/sale_action/change_showcase_groups），
汇率用内置假汇率（离线确定值），不发网络请求。
"""
import argparse
import sqlite3
import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from rates import RateService  # noqa: E402
from storage import Store  # noqa: E402

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


# ── 样本清单（19 副本 / 17 专辑；金额、日期、渠道、备注均为虚构）──────────────
# 每条 (键名, 记录)。键名仅脚本与测试内部引用。
RECORDS = [
    # 国内库存 domestic（7）
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
                   version='纸盒', pressing='日版', obi='带侧标', condition='近全新',
                   status='domestic')),
    ('minecraft', dict(title='Minecraft: Volume Alpha', artist='C418', currency='JPY',
                       price='', date='2026-07-18', location='示例唱片行·B 店',
                       version='Digipak', status='domestic', note='示例：成本未知（null，不当 0）')),
    ('shall-we', dict(title='Shall We Dance? Shall We Talk!', artist='陈奕迅', currency='CNY',
                      price='138', date='2026-07-25', location='示例二手平台', version='纸盒',
                      status='domestic')),
    ('illinois', dict(title='Illinois', artist='Sufjan Stevens', currency='JPY', price='2800',
                      date='2026-08-02', location='示例唱片行·A 店', version='Jewel Case',
                      status='domestic',
                      packaging={'structure': 'jewel', 'thickness': 'standard', 'tray': 'clear',
                                 'discs': 1, 'finish': 'matte'})),
    # 海外库存 overseas（4）
    ('dookie-en', dict(title='Dookie', artist='Green Day', currency='JPY', price='300',
                       date='2026-08-02', location='示例唱片行·C 店', version='Jewel Case',
                       pressing='外版', status='overseas')),
    ('loveless', dict(title='Loveless', artist='My Bloody Valentine', currency='JPY',
                      price='1500', date='2026-08-08', location='示例唱片行·C 店',
                      version='纸盒', pressing='外版', status='overseas')),
    ('tasogare', dict(title='盗作', artist='ヨルシカ', currency='JPY', price='1980',
                      date='2026-08-08', location='示例唱片行·C 店', version='Jewel Case',
                      status='overseas')),
    ('tpab', dict(title='To Pimp a Butterfly', artist='Kendrick Lamar', currency='JPY',
                  price='1700', date='2026-08-15', location='示例唱片行·B 店', version='Jewel Case',
                  pressing='日版', obi='带侧标', status='overseas')),
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
        return existing_ids(data_dir)
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


def main():
    p = argparse.ArgumentParser(description='灌入固定测试样本库')
    p.add_argument('--data-dir', required=True, help='目标数据目录（须为空目录或已灌过的样本库）')
    args = p.parse_args()
    ids = seed(args.data_dir)
    print(f'固定样本库已就绪：{Path(args.data_dir).resolve()}（{len(ids)} 副本）')
    print('启动：python3 app.py --port <空闲端口> --data-dir '
          f'{Path(args.data_dir).resolve()} --no-seed')


if __name__ == '__main__':
    main()
