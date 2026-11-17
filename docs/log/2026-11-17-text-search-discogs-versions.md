# 2026-11-17 · 文字搜索展开专辑时补上 Discogs 的版本

- **作者**：Claude
- **范围**：`server/text_search.py`、`server/routes.py`（`api_album_versions`）、`web/src/pages/AlbumResults.tsx`；测试 `tests/test_text_search.py`

## 出现的问题
用户发现按专辑名搜索时只出一个资料库的结果。原因：专辑列表按设计是 MusicBrainz 优先、Discogs 只在 MusicBrainz 无结果 / 不可用时兜底；展开专辑也只从这张专辑所在的库列版本，Discogs 有而 MusicBrainz 没有的版本看不到。

## 怎么解决的
展开 MusicBrainz 专辑时，前端带上专辑名与艺人；后端到 Discogs 搜同名同艺人的 master（标题、艺人去标点后严格相等才算），取其 CD 版本：唱片编号相同的记入 MusicBrainz 版本的 `alsoIn`，其余单列，合并后按日本版 / 有条码 / 日期排序。Discogs 编号逗号连写且常重复同号，改为 ` / ` 分隔并去重。Discogs 出错时静默只返回 MusicBrainz 的版本。master 与版本列表进 Discogs 客户端的缓存，同一张再展开不再请求。

## 验证
后端 637 项（新增：同编号并入、只有 Discogs 的单列、名字 / 艺人不符不并、Discogs 出错仍有结果、没带名字不问 Discogs 且有缓存、编号拆分去重）、前端 194 项、tsc、build。真实来源：Pink Floyd「Meddle」展开后 35 个版本，14 个标 MusicBrainz + Discogs，4 个只有 Discogs（如 TOCP-8254）；手机深色截图确认标签。

## 可能带来的新问题
第一次展开一张专辑要多两次 Discogs 请求（节流 2.5 秒），实测约 8–9 秒；之后命中缓存。Discogs 版本列表一次最多取 40 个。只有 Discogs 的版本没有条码，入库时会读详情再补。
