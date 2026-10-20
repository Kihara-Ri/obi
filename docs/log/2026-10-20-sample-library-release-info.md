# 2026-10-20 · 样本库补充：条码 / 国家 / 连锁渠道 / 已上架

- **作者**：Claude
- **范围**：`tools/seed_samples.py`、`tests/test_sample_library.py`、`docs/DECISIONS.md`（D-015）

## 改了什么
- 7 个副本补 `releaseInfo`（条码、唱片编号、国家、发行日期、厂牌、介质、碟数）：国家覆盖 JP / US / GB / DE / HK；条码取 GS1 保留前缀 200–299 并补校验位（`ean13`），不对应真实商品；`parachutes` 的编号为被重复拼接的 `A / A / A`，用于验证去重显示。`islands-jp`（无条码）与 `minecraft`（无国家）保持原样，作为回退场景。
- 渠道：6 个副本改用公开连锁零售商名称的不同写法 / 分店 / 线上店（BOOKOFF 秋葉原駅前店、Book Off 松本店、Disk union 下北沢店、diskunion 新宿、Tower Records 渋谷、tower.jp），其余仍为「示例…」。仅用于验证品牌归并与分店层级，不是真实购买记录。
- 已上架：除售出中的 m83，再让国内库存的 `parachutes`、`illinois` 上架（带渠道、链接、描述）。
- `test_release_info_chain_shops_and_listing_states_cover_the_new_ui` 覆盖上述全部场景（含条码校验位）。
- `docs/DECISIONS.md` 新增 D-015，记录详情 / 编辑信息架构的已确认结论。

## 出现的问题
无。已有断言（21 副本 / 19 专辑、islands-jp 无条码、各状态计数）均未受影响。

## 怎么解决的
`python3 -m unittest discover -s tests`：453 个测试 OK（1 跳过）。

## 可能带来的新问题
- 固定预览目录 `/private/tmp/diedu-acceptance` 是幂等跳过的，看不到新样本；需要显式 `--rebuild`（会归档后重建，见 AGENTS.md）。
- 渠道名用了真实连锁品牌名，若以后要求样本渠道全部虚构，需改成「示例品牌 + 分店」并同步别名表。
- 未部署（样本库只用于测试与预览）。
