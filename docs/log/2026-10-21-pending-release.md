# 2026-10-21 · 待确认发行版提示与绑定

- **作者**：Claude
- **范围**：`web/src/core/lookup.ts`、`pages/{LookupPage,PendingReleases,confirmRelease,LookupCard,AlbumResults,ShelfPage}`

## 判定
没有 MusicBrainz / Discogs 版本编号，也没有 `manualRelease==='1'`；已售出与回收站不算。没有条码的专辑（如 Lift Your Skinny Fists…）靠文字搜索确认版本，不要求条码。

## 做法
- 库存页汇总行「N 张待确认版本 ›」→ 查询页；查询页空闲时列出这些专辑。
- 点一张：有条码按条码查，查不到或没条码改用专辑名 + 艺人文字搜索；结果卡片的主按钮变「确认为这张的版本」，经 `records` 局部更新绑定（revision 校验、条码校验沿用服务端），只改发行资料，用户自己的刻码 / 附件 / 观察记录保留。
- 「查不到，标为已处理」复用 `manualRelease`，不新增字段。

## 验证
浏览器（手机宽度，真实 MusicBrainz，样本库）：待确认列表 17 张；Dookie 条码（样本里是假的）查不到 → 自动文字搜索 → 展开日本版 → 确认后记录带 MB 版本编号、条码、编号、14 首曲目，revision 加 1，待确认降到 16，库存页汇总行同步。单测覆盖 `releasePending`。没验证「标为已处理」按钮与 Discogs 来源的绑定。
