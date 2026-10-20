# 2026-10-19 · 未收录版本：Discogs 备用来源与手动录入

- **作者**：Claude
- **范围**：`server/discogs_catalog.py`（新）、`server/release_catalog.py`、`server/routes.py`、`domain.py`、`app.py`、`web/src/forms/RecordForm.tsx`、`web/src/types.ts`、相关测试与文档

## 改了什么
条码 / 编号检索先查 MusicBrainz，无精确匹配或不可用再查 Discogs；响应带 `sources`。两处都没有时前端提示并给「按未收录版本手动录入」。新增 `discogsReleaseId`、`manualRelease`，保存校验按来源分流。前端检索加 70 秒兜底超时。

## 出现的问题
- IECP-50008 / 4582213912173 在 MusicBrainz 确为 0 条；Discogs 公开接口（无需密钥）有 release 7714607，条码、目录号、曲目都对得上。
- 新录入只有「确认 MusicBrainz 发行版」一条保存路径，查不到即死路；MusicBrainz 对本机偶发 503 限流（实测首个请求即发生），旧代码只报“暂时不可用”。
- 选定版本后封面检索约十余秒占用 busy，期间点保存只提示“请稍候”，容易被当成卡住（未改，仅记录）。
- 未能复现“无限转圈”：当前代码对空结果会显示提示；真实卡住很可能是限流/网络慢叠加无出路，不能确证。

## 怎么解决的
见上；Discogs 候选必须人工选择，手动版本不伪造来源，也不生成 3D。

## 可能带来的新问题
- Discogs 公开接口限额约 25 次/分，限流后冷却 30 秒。
- RecordForm.tsx 已在后续一条日志中拆分，见 `2026-10-19-record-form-split-and-lookup-flow.md`。
- 浏览器控制台出现两条“fetching the script”，未确认来源（疑似浏览器窗格的 service worker），与本改动无关联证据。
- 已验证：后端 446 项通过；前端 typecheck/build 通过；真机浏览器走通 Discogs 选版入库与手动录入入库。iOS 真机、Docker 构建未验证。
