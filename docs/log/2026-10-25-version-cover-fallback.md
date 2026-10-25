# 2026-10-25 · 版本封面统一退路：此版本 → 同一张专辑 → iTunes（D-027）

- **作者**：Claude
- **范围**：`covers.py`（`group_front`、`fallback`）、`server/routes.py`（`/api/covers/fallback`）、`static/local/engine-worker.js`（本机网络引擎放行）、新增 `web/src/core/version-cover.ts`、`components/ReleaseCandidateCard`、`forms/record/releaseCover.ts`、`forms/record/pickRelease.ts`（抽出 `applyCover`）、`forms/RecordForm.tsx`、`core/release-metadata.ts`（删 `exactDigitalCover`）、`封面搜索.md`、`tests/test_cover_fallback.py`

## 出现的问题
条码 0889854284329（The Chainsmokers 澳大利亚版）：版本卡片显示「无封面」，点「换一张封面」却找到 2 张。卡片只看此版本自己的 CAA 图；选用后匹配另试 iTunes；换封面再宽搜，三处顺序不一。另外查询页「以此入库」带入的表单完全不自动配封面。

## 怎么解决的
按用户要求：尽量用这个版本自己的封面，没有再用更宽泛的。服务端 `CoverService.fallback` 给出「同一张专辑的封面 → 同名 iTunes 数字封面」中精确对上的一张（带 `kind`）；前端 `version-cover.ts` 统一顺序并只问一次。卡片的封面改为来源链（此版本 → 调用方给的同专辑图 → 服务端退路），等待退路期间不再让旧图的超时重试把卡片提前判成无封面；借来的封面按 `kind` 提示。选用后匹配与以此入库共用 `matchReleaseCover` + `applyCover`。

## 验证
后端全量测试（新增 4 个退路用例）与前端测试通过。样本库实测该条码：查询页卡片显示同专辑封面并注明来源；以此入库后表单自动匹配「同一张专辑的封面（不一定是此版本）」；控制台无错误。

## 可能带来的新问题
此版本没有图时多一次服务端查询，卡片封面会晚几秒出现；借来的封面可能与实物包装不同（已提示）。
