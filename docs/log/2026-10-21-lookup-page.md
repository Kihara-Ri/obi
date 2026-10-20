# 2026-10-21 · 条码 / 唱片编号查询页

- **作者**：Claude
- **范围**：`web/src/pages/LookupPage.{tsx,css}`、`core/lookup.ts`、`core/{modules,page-back}.ts`、`App.tsx`、`pages/MorePage.tsx`、`forms/RecordForm.tsx`、`forms/record/{context,useReleaseLookup}.ts`、`web/tests/lookup.test.mjs`、AGENTS.md、使用说明、CHANGELOG

## 改了什么
- 新增只读「查询」页：一个输入框自动识别条码（8/12/13/14 位并校验 GS1 校验位）或唱片编号；先列库里已有的同条码 / 同编号副本（点进详情），再查 MusicBrainz，无结果转 Discogs（后端 `/api/catalog/*` 未改）。
- 「以此入库」把已确认的候选带入新增表单（`openRecordForm` 新增可选 `seed`，`seedFields` 填身份与资料；检索 hook 按已确认处理）。
- 最近查过（最多 8 条）只存浏览器。入口：手机「更多」、桌面侧栏。

## 验证
- 前端 135 项通过（新增 4 项：校验位、识别、本地命中、最近查询）；typecheck、build 通过。
- 浏览器（固定样本库 + 真实 MusicBrainz）：本地条码命中显示库里已有；`AMCY-2434` 找到 1 个版本；「以此入库」打开新增表单，发行版显示「已确认 · MusicBrainz」。

## 没验证 / 限制
- 带入表单时不预取封面（需要时在表单里点「重新匹配」）；手机宽度与摄像头扫码未做。
