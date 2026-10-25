# 2026-10-25 · 封面来源角标；已确认版本去掉重复的来源标

- **作者**：Claude
- **范围**：新增 `components/ReleaseCandidateCard/ReleaseSummary.tsx`（从卡片拆出，卡片文件不超过 200 行）、`core/version-cover.ts`（`originOf` / `ORIGIN_LABEL`）、`components/ReleaseCandidateCard`（`OriginTag`、封面外框、来源改为艺人下一行）、`forms/record/ReleaseLookupSection`（状态行带来源链接）、`forms/RecordForm.tsx`、`forms/record/releaseCover.ts` 与 `useCoverSearch.ts`（记录来源 provider）、`pages/AlbumResults.tsx` 与 `styles/components.css`（`.ah-src` 改为共用 `.cover-origin`）、`components/REGISTRY.md`

## 出现的问题
用户反馈：封面看不出从哪来；表单里「已确认 · MusicBrainz」和摘要头部右侧的「MusicBrainz ↗」重复，后者还占一列，把封面和专辑名 / 艺人挤窄。

## 怎么解决的
- 封面右下角统一角标：此版本 / 同专辑 / iTunes / 上传。卡片按当前封面来源链判断；表单按 `coverSource.provider` 判断（此版本封面与上传现在都记 provider；旧记录没记来源的不标）。查询页专辑列表原有的 `.ah-src` 角标改为同一个 `.cover-origin` 样式。
- 已确认时来源链接只在状态行（「已确认 · MusicBrainz ↗」）；未确认 / 手动 / 非官方的标签改为艺人下一行小字，不再占头部右侧。

## 验证
前端测试通过；样本库 375×812 实测条码 0889854284329：版本卡片角标「同专辑」，以此入库后表单状态行带链接、摘要头部无重复标签、标题一行排开、点封面放大后角标随封面在右下角；控制台无错误。

## 可能带来的新问题
旧记录的封面若当时没记来源，不显示角标。
