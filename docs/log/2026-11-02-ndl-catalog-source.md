# 2026-11-02 · 唱片编号新增国会图书馆（NDL）来源

- **作者**：Claude
- **范围**：新增 `server/ndl_catalog.py`；`server/release_catalog.py`（`backups` 编号链路、详情分发）、`server/release_merge.py`（NDL 按编号并入）、`server/routes.py`（`release_identity`、`verify_barcode_release` 拒绝 NDL）、`domain.py`（`ndlBibId`）、`app.py`、`server/local_entry.py`（注释）；前端 `core/release-source.ts`、`types.ts`、`core/lookup.ts`、查询中文案；测试 `tests/test_ndl_catalog.py` 等；D-037、AGENTS / README / 使用说明 / 部署说明 / CHANGELOG

## 起因
用户问哪些来源查日本盘好用。实测：VGMdb、Tower 返回 403；乐天 BooksCD 需应用 ID；NDL OpenSearch 按 AVCA-29189 直接命中。用户定案接入 NDL。

## 改了什么
- `NdlCatalog`：OpenSearch `any=` 找「録音資料」且 RIS502 完全一致的书目（最多 5 条），SRU `itemno=` 取 dcndl 完整记录；介质含 CD 才列出。字段：标题、表演者（dc:creator）、レーベル名 / 出版者、JP、发行年月、碟数、收录曲。缓存搜索与详情。
- 编号链路并发 MusicBrainz / Discogs / NDL；合并时 NDL 按编号并入同号实体版的「另见」，否则单列。
- NDL 版本带条码保存一律拒绝并说明原因（NDL 不登记条码，无从核对）；无条码按编号保存正常。

## 出现的问题
- SRU 的 `anywhere="AVCA-29189"` 返回「Record does not exist」，编号只能走 OpenSearch；详情仍需 SRU（OpenSearch 摘要没有曲目与「: CD」）。
- 第一次实测出现一次连接超时，单独请求正常，之后稳定；超时按来源错误如实显示，不影响其他来源。
- 实测 NDL 偶发整条请求卡住（curl 连续 6 次里 2 次卡满 30 秒，Python 也一样，不是 IPv6 问题），一卡住整次编号查询都跟着等，最坏（找书目 + 5 条详情都超时）会超过前端 70 秒兜底。`lookup_sources` 加 20 秒总时限：超时来源标为跳过、先返回其他来源结果，后台线程跑完写缓存；NDL 单次超时 12 → 8 秒。这个时限对条码链路同样生效。
- `clean_release_info` 会丢掉未登记字段，`ndlBibId` 须先进 `RELEASE_FIELDS`。

## 可能带来的新问题
- 编号查询总等待可能被 NDL 拉长（正常 1～6 秒；卡住时最多等到 20 秒总时限）。超时被跳过的那次查询看不到 NDL 结果，再查一次通常就有（后台已写缓存）。
- 收录曲靠「(n)」编号拆分；格式不同的记录（无编号、按碟分段写法不同）可能拆得不理想，但不会臆造曲名。
- 范围写法的多碟编号匹配不到；NDL 没有封面。
- 已验证：后端 579 项、前端 175 项全绿；真实网络 AVCA-29189 命中且详情三轨、厂牌 avex mode、2009-04、CD 1 枚；AVCA-2918 与条码查询返回空。

## 关联
2026-10-29-concurrent-release-lookup.md · D-033 · D-037
