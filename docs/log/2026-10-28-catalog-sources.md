# 2026-10-28 · 条码备用源改为 Deezer；Bandcamp 只作封面来源

- **作者**：OpenCode agent（DeepSeek V4.1 Flash，按 D-028 与恢复的源码整理）
- **范围**：`server/release_catalog.py`、`server/deezer_catalog.py`、`covers.py`、`web/src/core/release-source.ts`、查询页与候选卡片、封面面板、D-028、I-017、测试。

## 改了什么

条码精确检索在 MusicBrainz 未命中时改查 Deezer（Discogs 搜索不索引条码）；唱片编号仍查 Discogs。新增 `deezerId` 与来源分发；Deezer 只按数字发行呈现，不写 CD 与碟数。Bandcamp 不进发行版链路，只在封面面板提供「从网址」，按 `f4.bcbits.com` 白名单下载。

## 出现的问题

原「MusicBrainz 没命中就查 Discogs 精确条码」实际一直空转（Discogs 的 `barcode=` / `q=JAN` 都返回 0，只有 `catno=` 可用）；Bandcamp 主站对标准库 TLS 指纹返回挑战页。

## 怎么解决的

条码链路改成 MusicBrainz → Deezer；编号链路保留 MusicBrainz → Discogs。来源判断收敛到 `core/release-source.ts`；Bandcamp 只做封面地址。测试按新链路重写，并补 `tests/test_deezer_catalog.py`。

## 可能带来的新问题

Deezer 覆盖的是数字发行，初回 / 限定盘的独立 JAN 往往仍查不到；封面仍需人工核对。本机模式不接 Deezer（无 CORS）。源码由 Docker 构建缓存恢复，Deezer 原测试文件未能复原，现测试为按新接口重写。

## 关联

D-028 · I-017 · `2026-10-28-opencode-provider.md`
