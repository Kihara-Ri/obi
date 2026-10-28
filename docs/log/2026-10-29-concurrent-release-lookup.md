# 2026-10-29 · 条码 / 编号检索改为并发查询并合并

- **作者**：Claude
- **范围**：`server/routes.py`（`lookup_sources` 重写）、`server/release_catalog.py`（`fallback` / `backup` → `backups`）、新增 `server/release_merge.py`；前端 `types.ts`（`alsoIn`）、`ReleaseSummary`（另见）、`ReleaseCandidateCard` 与 `forms/record/releaseCover.ts`（同码数字封面）、查询中文案；测试 `tests/test_release_merge.py`、`test_barcode_lookup.py`、`test_itunes_catalog.py`、`test_release_metadata.py`；D-033、AGENTS / README / 使用说明 / 部署说明 / CHANGELOG

## 起因
用户提议「并发查各库后先给专辑定位，再去匹配该品类最全的库」。最全的日本库没有可用接口，于是定案为第一层：并发 + 精确合并，JAN 前缀只排序（见 D-033）。

## 改了什么
- 所有适用来源同时查询，`sources` 按来源顺序如实列出；全部来源出错才报错。去掉 1.5 秒对冲（hedge）参数。
- `release_merge.merge`：实体在前、数字在后；同码数字发行并入实体版 `alsoIn` 并借封面；Discogs 需编号 + 条码都相同才并入；两条数字同码留更全的；日本 JAN 下日本区实体版、iTunes 排前。不修改传入候选（各来源缓存里的对象不被污染）。
- 卡片显示「另见 Deezer / iTunes ↗」；实体版没有 CAA 正面图时用同码数字封面。

## 出现的问题
- `test_release_metadata` 的旧夹具没有 `backups`：并发后 MusicBrainz 命中也会问备用来源，属预期行为变化，补夹具。
- 实测快速连查时 MusicBrainz 返回「正忙」，此时其他来源结果照常返回，`sources` 标出 MusicBrainz 的错误。
- MusicBrainz 条码检索按原样查询，13 位带前导 0 的 EAN 查不到以 12 位 UPC-A 登记的条目（反之亦然）。已修：`ReleaseCatalog.catalog` 对 13 位 0 开头 / 12 位的码查 `barcode:("0…" OR "…")`，候选匹配与 `verify_barcode_release` 的 MusicBrainz 分支都按去前导零比较（否则选中 12 位登记的版本会核对失败）。实测 0720642442524（Nevermind 美版 CD）由 none 变为 15 个版次、核对通过；0888837168618 在 MusicBrainz 只有黑胶，仍为 none（正确）。
- 上面的实测暴露合并规则两个问题并已修：① MusicBrainz 同码同编号的不同版次被当成同一版本互相折叠——改为只有跨来源（Discogs → MusicBrainz）才合并；② 同码对应多张实体版时，iTunes 封面借给了第一条（一张私录）——改为每条同码实体版都记「另见」，只有唯一一条时才借封面；`alsoIn` 每个来源只记一条（iTunes 同码返回 5 条时不再重复列出）。

## 可能带来的新问题
- 每次条码查询都会打 Deezer 与 iTunes；iTunes 限流（常回 403）会触发 60 秒冷却，冷却期间 iTunes 显示为不可用，不影响其他来源。
- 本机模式线程池是内联的，仍串行。
- 借来的数字封面与实体版同码，但初回贴纸等细节未必一致。
- 已验证：后端 547 项、前端 164 项全绿；真实网络 4988064291892（仅 iTunes）、4988013047105（仅 MusicBrainz）、0888837168618（iTunes 两条同码合并）均约 1 秒返回。

## 关联
2026-10-29-itunes-barcode-source.md · D-033 · D-028
