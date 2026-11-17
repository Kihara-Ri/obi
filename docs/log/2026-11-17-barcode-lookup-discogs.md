# 2026-11-17 · 条码查询加入 Discogs、两种写法互查；查完不再一直转圈

- **作者**：Claude
- **范围**：`server/release_catalog.py`、`server/routes.py`（注释）、`web/src/core/lookup.ts`、`web/src/forms/record/useReleaseLookup.ts`；测试 `tests/test_itunes_catalog.py`

## 出现的问题
1. 用户扫 Pink Floyd「Meddle」美国盘（PRL2-791499），手机读成 13 位 `0603497914999`，查不到；删掉前导 0 仍查不到；用编号却能在 Discogs 查到，且条码正确。实测：MusicBrainz、Deezer、iTunes 都没有这张，只有 Discogs 有；而条码查询从不问 Discogs（注释称其「搜索接口不索引条码」，实测不成立）。Discogs 又只认登记原样：12 位能查到，补 0 的 13 位查不到。
2. 查询时一直转圈，直到选定版本才停。扫码 / 照片识别会先改条码（进入待校验）再立即查询；550ms 后的自动检索与它同键、复用同一请求，而只有自动检索结束时才退出「待校验」，于是转圈挂到选版本为止。

## 怎么解决的
- 条码查询的备用来源改为 Discogs、Deezer、iTunes；原样查不到时，用另一种写法（12 位 UPC-A ↔ 补 0 的 13 位 EAN）再查一次（`barcode_twin`，MusicBrainz 原有的互查共用它）。查询进度卡同步列出 Discogs。
- 任意条码检索结束（有无结果、出错）都退出「待校验」。

## 验证
后端 632 项（新增：扫出 13 位时退回 12 位命中 Discogs、首次命中不再查第二种写法）、前端 193 项、tsc、build。真实来源端到端：`0603497914999` 与 `603497914999` 都查到 Meddle / PRL2-791499。转圈：把条码接口人为延迟 3 秒，旧代码找到版本后 40 秒仍在转，新代码结果一到即停。

## 可能带来的新问题
Discogs 有 2.5 秒节流，查第二种写法最多多等约 2.5 秒（仍在 20 秒总时限内）。条码查询多了一个来源，候选可能比以前多。
