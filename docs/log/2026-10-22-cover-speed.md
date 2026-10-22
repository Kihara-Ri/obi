# 封面提速与放大（v3.5.3）

## 慢在哪（实测本机到各来源：CAA 图集 JSON 约 3.3 s、前 500px 图约 2 s、iTunes 0.3 s、MusicBrainz 1.5 s）
- 查询卡片原先走 `/api/catalog/front-cover`：先读 CAA 图集 JSON，再下 1200px 预览，两次串行，再 base64 塞进 JSON；本机模式还要排在网络引擎里同步 XHR。
- 「换一张封面」= `CoverService.layered_search`：iTunes 艺人目录（日本→美国，各两次请求）→ 关键词搜索，同一主机限速 3.1 s 一次，最坏要排 8 次请求；2 s 后并行启动 MusicBrainz：搜索 release-group → 每个组先列发行 → 再逐个读 CAA 图集 JSON，原本逐组串行；有 release_id 时 `merge_identity` 还会按规范名再整体搜一遍。
- 数据源：iTunes Search（mzstatic 图）、MusicBrainz + Cover Art Archive。iTunes 的 3.1 s 间隔是对其约 20 次/分钟限制的保守取值，未改。

## 改了什么
- 卡片封面：浏览器直取 `coverartarchive.org/release/<id>/front-250`（404 即无正面图，图的 onError 变「无封面」）；点击在卡片内放大（`useArtExpand`：切换布局后量前后位置，封面按宽高、文字按位移、头部按高度做 WAAPI 过渡；放大时换 `front-500`，250 图作底；减少动态效果时直接切换），不走照片灯箱。CSP 的 img-src 本来就放行 CAA / archive.org。
- `/api/catalog/front-cover`：自带 ArtClient 时直取 `front-1200`（一次请求），内存小缓存；插件图集接口仍走两步。
- `CoverService.download` 支持 `CAAR-<mbid>` 令牌（此版本正面图），前端「换一张封面」先本地摆出这个候选，缩略图加载失败自动撤下。
- `archive_candidates` 各专辑组并行取图。
- 未改：iTunes 的限速与请求次数。要再快需要放宽限速或减少兜底请求，有被限流的风险，留待有数据再定。
