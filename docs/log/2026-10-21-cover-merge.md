# 2026-10-21 · 封面匹配精简并入发行版卡片

- **作者**：Claude
- **范围**：`web/src/forms/record/{useCoverSearch,releaseCover,pickRelease,CoverPanel,ReleaseLookupSection,useReleaseLookup,useRecordHints}`、`forms/RecordForm.tsx`、`components/ReleaseCandidateCard`、`styles/drawer.css`

## 调查结论（改动前）
封面有三个入口：选版后自动匹配（iTunes 精确 + 此版 CAA 并行）、标题 / 艺人失焦 450ms 自动搜（`covers/search` AUTO）、「重新匹配」按钮。前两者重复同一件事，条码流程里失焦那条基本不触发；`coverBusy` 在发行版 hook、其余封面状态在封面 hook，跨文件互改。

## 改了什么
- 删掉失焦自动搜（`scheduleCover` / `lastQuery`）；`findCover` 只服务「换一张封面」，列候选由用户点选。
- 选版后封面：此版本 CAA 正面图优先（有图立即返回，不等 iTunes），其次 iTunes 精确数字封面；已有封面不覆盖。
- `busy` 归入封面 hook，`pickRelease` / 发行版 hook 不再传 `setCoverBusy`。
- 封面缩略图并入卡片：候选卡片按需取此版本正面图；已确认版本卡片带封面，状态与「换一张封面」嵌在卡片里（`CoverPanel inline`）；没有确认版本（旧记录 / 手动）时仍用独立封面区块。

## 验证
- 浏览器（真实 MusicBrainz）：搜 `AMCY-2434` 候选卡片带封面；选用后确认卡片带封面，状态「已匹配 · 此版本封面（Cover Art Archive）」，无独立封面区块。前端 136 项、类型检查、构建通过。
