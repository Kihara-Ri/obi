# 2026-11-03 · Discogs 版本带入包装信息

- **作者**：Claude
- **范围**：`server/discogs_catalog.py`（`PACKAGING_TERMS` / `_packaging`）、`tests/test_discogs_catalog.py`、`CHANGELOG.md`

## 出现的问题
用户发现不同数据源有的带包装、有的不带。核查：MusicBrainz 返回 `packaging`；Discogs 只取了版次与介质，未读包装；Deezer / iTunes 是数字发行，没有包装概念。Discogs 命中时 `version` 为空，只能靠表单里必选的包装图标卡手选。

## 怎么解决的
Discogs 详情读取 `formats[].descriptions` 与 `formats[].text`，仅对明确词（digibook / digipak / jewel case 系列 / card sleeve 系列 / gatefold）映射到与 MusicBrainz 同口径的包装名，按固定优先级取一个；认不出留空，仍走手选。Deezer / iTunes 不变。

## 可能带来的新问题
- 词表是按 Discogs 常见写法拟定，未对真实 Discogs 数据逐条核对；遇到未收录写法只会留空，不会错配。
- Gatefold 映射为「Gatefold Cover」（对折纸套）；Digipak 带 Gatefold 时取 Digipak。
- 只在选定版本、读取详情时带入，搜索结果卡片上不显示包装。

## 验证
后端 581 项全绿（新增 Discogs 包装映射断言）。未用真实 Discogs 数据联网验证。
