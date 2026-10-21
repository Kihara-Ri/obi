# 2026-10-21 · 查询页文字搜索

- **作者**：Claude
- **范围**：`server/text_search.py`、`server/release_catalog.py`（抽出 `candidate`）、`server/routes.py`、`web/src/pages/{LookupPage,AlbumResults}`、`core/lookup.ts`

## 改了什么
- `/api/catalog/search`：词逐个在 release group 标题或艺人里匹配（Lucene 转义），按专辑去重，返回封面（Cover Art Archive release-group 图）、年份、类型；MusicBrainz 无结果或不可用再用 Discogs master 兜底。
- `/api/catalog/versions`：某专辑的 CD 版本，候选与条码检索同形，日本版 / 有条码 / 较早的在前。
- 前端：`isTextQuery` 判断文字；结果两层（专辑行 → 版本卡片，沿用 `LookupCard` 的复制 / 入库）；库里已有的专辑排前并有「库里已有」入口；版本超过 5 个折叠。编号无精确匹配时自动再按文字搜一次。
- 只在查询页；专辑表单的发行版检索不变。

## 验证
- 后端 `tests/test_text_search.py`（夹具）；前端 `isTextQuery` / `ownedAlbums` 单测。
- 浏览器（手机宽度，真实 MusicBrainz）：`illinois sufjan stevens` 只出一张「Illinois」并标已有，展开后日本版在前；`radiohead` 出 10 张专辑。Discogs 兜底只有夹具测试，没有联网验证。

## 追加：版本卡片折叠
`ReleaseCandidateCard` 新增 `fold` 属性（仅查询页传入）：默认一行摘要，展开才有完整资料和操作，省纵向空间；表单里不传，行为不变。

再改：去掉底部「收起」，折叠卡片头部一行始终在原位，右侧 + 与 − 同一位置动画切换，主体用 grid 行高过渡展开 / 收起（收起时 `inert`）。

## 追加：版本列表整理
MusicBrainz 同一专辑常有多条完全相同的收录（同编号 / 地区 / 日期 / 厂牌 / 条码）：后端 `group_versions` 只留第一条；发行日全是 0 的当作空。库里记录的唱片编号与某版本对上时，该版本标「库里这张」并排最前——旧记录没有条码时靠编号认。
