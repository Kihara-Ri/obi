# 2026-10-29 · 条码第三备用源 iTunes

- **作者**：Claude
- **范围**：新增 `server/itunes_catalog.py`；`server/release_catalog.py`（备用链路）、`server/routes.py`（`lookup_sources`、`verify_barcode_release`、新增 `release_identity`）、`domain.py`（`itunesId`）、`app.py`、`server/local_entry.py`；前端 `core/release-source.ts`、`types.ts`、`forms/detail/ReleasePage.tsx`、查询页文案；测试 `tests/test_itunes_catalog.py` 等；D-028 补充、AGENTS / README / 使用说明 / 部署说明 / CHANGELOG

## 现象
用户扫《Ride the Wind》（JAN 4988064291892 / AVCA-29189，假面骑士 Decade 角色歌）查不到任何结果，GPT 却能给出完整资料。实测 MusicBrainz（条码、编号）、Deezer（`album/upc:`）、Discogs（`catno=`）均为 0；iTunes `lookup?upc=…&country=jp` 精确命中。

## 改了什么
- `ItunesCatalog` 仿 `DeezerCatalog`：精确 UPC、先 jp 后 us、0.5 秒节流、403/429 冷却 60 秒、缓存；候选 `itunes-<collectionId>`，数字发行语义（不写 CD / 碟数），封面换成 1200 / 300 尺寸的 mzstatic 地址。
- `ReleaseCatalog.backup` 返回 `(候选, {来源: 状态})`，条码链路 Deezer → iTunes，前者命中即停、出错继续；全部出错才抛错。`lookup_sources` 合并这些状态；全部失败时标签为「备用来源」。
- 条码核对：iTunes 详情不回带条码，`verify_barcode_release` 对 `itunes-` 改用 `has_barcode`（按条码重查）。
- 本机模式接入 iTunes（它回 CORS `*`，Deezer 不回）。

## 出现的问题
- **Deezer 版本带条码保存一直失败**：`api_records` 的版本身份只认 MusicBrainz / Discogs，Deezer 版本得到空身份，`verify_barcode_release(barcode, '')` 报「请先查询并选择对应的发行版本」。加 Deezer（2026-10-28）时漏改。抽出 `routes.release_identity` 覆盖四个来源，补回归测试（旧代码下确认失败）。
- 专辑详情「来源」只认 MusicBrainz / Discogs，改用 `release-source.ts` 的 `sourceName / sourceUrl`。

## 可能带来的新问题
- iTunes 的 `artistName` 是 Apple 的署名写法（如全角括号 CV 标注），可能与本地已有艺人名不完全一致。
- Apple 限流阈值不公开（约 20 次 / 分钟），封面检索（`covers.py`）走另一套节流，两者叠加时可能更早触发 403 冷却。
- 已验证：后端 534 项、前端 164 项全绿；真实网络下该 JAN 走完 MusicBrainz none → Deezer none → iTunes found，详情三轨与时长、厂牌 AVEX ENTERTAINMENT INC.、条码核对通过。

## 关联
2026-10-28-catalog-sources.md · D-028
