# 2026-10-21 · 条码 / 唱片编号查询页

- **作者**：Claude
- **范围**：`web/src/pages/LookupPage.{tsx,css}`、`core/lookup.ts`、`core/{modules,page-back}.ts`、`App.tsx`、`pages/MorePage.tsx`、`forms/RecordForm.tsx`、`forms/record/{context,useReleaseLookup}.ts`、`web/tests/lookup.test.mjs`、AGENTS.md、使用说明、CHANGELOG

## 改了什么
- 新增只读「查询」页：一个输入框自动识别条码（8/12/13/14 位并校验 GS1 校验位）或唱片编号；先列库里已有的同条码 / 同编号副本（点进详情），再查 MusicBrainz，无结果转 Discogs（后端 `/api/catalog/*` 未改）。
- 「以此入库」把已确认的候选带入新增表单（`openRecordForm` 新增可选 `seed`，`seedFields` 填身份与资料；检索 hook 按已确认处理）。
- 最近查过（最多 8 条）只存浏览器。入口：手机「更多」、桌面侧栏。

## 追加：更多信息与一键复制
- 卡片拆为 `LookupCard`：「详情」按需取 `release-details`，显示厂牌、地区、发行日、包装、版次说明、介质、碟数与曲目时长（复用 `Tracklist`）。
- 「复制资料」/「复制为提问」：`core/lookup-text.ts` 生成文字（不含实物观察字段与个人信息；提问版前置一句要求不编造）。浏览器实测复制内容正确。

## 追加：卡片重新设计
- 结果卡片：名称 + 来源徽标 → 关键信息两列网格（编号、条码、厂牌、地区名、发行日）→ 可展开的「曲目与版本资料」→ 复制两键 → 整宽「以此入库」。详情只补摘要里没有的字段（包装、版次说明、介质、碟数、曲目），不再与上方重复。
- 库里已有：带封面缩略图、去掉标题方括号、状态用统一的 pill。

## 追加：专辑表单的检索与查询页合并
- `ReleaseLookupSection` 去掉条码 / 编号切换，单输入框按「只含数字空格连字符 → 条码，否则 → 编号」识别；条码在表单与检索里都检查 GS1 校验位。
- 候选改用共用的 `ReleaseCandidateCard`（选用此版本），已确认摘要用 `ReleaseSummary`；样式随组件，旧的 `.release-card`/`.rc-*` 从 drawer.css 删除，检索区样式搬到 `ReleaseLookupSection.css`。
- 浏览器（手机宽度、真实 MusicBrainz）：输入编号出候选卡片，选用后显示已确认摘要；错误校验位给出提示。

## 验证
- 前端 135 项通过（新增 4 项：校验位、识别、本地命中、最近查询）；typecheck、build 通过。
- 浏览器（固定样本库 + 真实 MusicBrainz）：本地条码命中显示库里已有；`AMCY-2434` 找到 1 个版本；「以此入库」打开新增表单，发行版显示「已确认 · MusicBrainz」。

## 没验证 / 限制
- 带入表单时不预取封面（需要时在表单里点「重新匹配」）；手机宽度与摄像头扫码未做。
