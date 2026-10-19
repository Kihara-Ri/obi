"""新实例的起步示例：空库首次启动时写入两张示例专辑，兼作使用指引。

只在库里没有任何记录、且从未写入过示例时执行一次（meta 标记 `starter-seeded`）；
已有数据的实例、`--no-seed` 启动均不触碰。记录只含名称、艺人、年份与备注：
不含买入金额、日期、渠道，成本保持 null。备注即指引文字，用户可直接改写或移入回收站。
决策见 docs/DECISIONS.md D-006。
"""

STARTER_META_KEY = 'starter-seeded'

# 名称与 MusicBrainz 发行版一致（条码 656605892627 / 796441804320）
STARTER_ALBUMS = [
    {
        'title': 'Illinois',
        'artist': 'Sufjan Stevens',
        'releaseYear': '2005',
        'note': '示例：点艺人名打开艺人资料；在详情里可以修改或移到回收站。',
    },
    {
        'title': 'Lift Yr. Skinny Fists Like Antennas to Heaven!',
        'artist': 'Godspeed You! Black Emperor',
        'releaseYear': '2000',
        'note': '示例：添加新专辑时先输入条形码，系统会匹配发行版后再带入资料。',
    },
]


def seed_starter(store):
    """空库写入示例专辑，返回写入条数；已写过或库中已有记录则返回 0。"""
    with store.connect() as db:
        if db.execute('SELECT 1 FROM meta WHERE key=?', (STARTER_META_KEY,)).fetchone():
            return 0
        has_records = db.execute('SELECT 1 FROM records LIMIT 1').fetchone()
    if has_records:
        # 已有数据的实例只记标记，之后即使清空也不再注入示例
        _mark(store)
        return 0
    items = [{**a, 'currency': 'CNY', 'status': 'domestic'} for a in STARTER_ALBUMS]
    store.save({'items': items})
    _mark(store)
    return len(items)


def _mark(store):
    with store.connect() as db:
        db.execute("INSERT OR REPLACE INTO meta VALUES(?, 'true')", (STARTER_META_KEY,))
