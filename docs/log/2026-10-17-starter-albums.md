# 2026-10-17 · 空库首次启动写入两张示例专辑

- **作者**：Claude
- **范围**：`server/starter_albums.py`（新）、`app.py`、`tests/test_starter_albums.py`（新）、`使用说明.md`、`docs/DECISIONS.md`（D-006）

## 改了什么
新增 `server/starter_albums.py`，定义两张示例专辑（Sufjan Stevens《Illinois》、Godspeed You! Black Emperor《Lift Yr. Skinny Fists Like Antennas to Heaven!》，条码 656605892627 / 796441804320）及各自的指引备注。`app.py` 在非 `--no-seed` 启动时于 `seed_from_json` 之后调用 `seed_starter`：仅当库中无记录且未写过标记（meta `starter-seeded`）时经 `storage.save` 写入一次。使用说明补充说明。

## 出现的问题
`seed_from_json` 只导入数据目录里的 `albums.json`，仓库本身不带任何数据，无法随安装提供示例。

## 怎么解决的
新增独立的起步清单与一次性写入，走 `storage.py` 事务，不直接写库；已有数据的实例不受影响。示例不含买入金额/日期/渠道，成本为 null。决策见 D-006。

## 可能带来的新问题
- 示例无封面，需在应用内手动搜索封面。
- 清单属于个人喜好，仓库内可见；若维护者不希望公开，删除 `STARTER_ALBUMS` 即可（相应测试需同步调整）。
- 若某个已安装实例恰好是空库且从未写过标记，启动后会出现这两张示例。

## 验证
- `python3 -m unittest tests.test_starter_albums`：4 项通过（空库写入、只写一次、删除后不重注入、已有数据不动）。
- `python3 -m unittest discover -s tests`：392 项，1 项跳过，其余通过。
- 真实启动：`python3 app.py --port 8791 --data-dir <临时目录>`，数据库中为两条 domestic 记录、price 为空，meta 标记已写入；已停止并清理临时目录。

## 关联
D-006、D-005（数据与导入路径）
