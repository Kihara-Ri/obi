# 2026-11-17 · 查询结果标注资料库名称

- **作者**：Claude
- **范围**：`web/src/core/release-source.ts`（`candidateSources`）、`web/src/components/ReleaseCandidateCard/ReleaseSummary.tsx`（`SourceTags`）、`ReleaseCandidateCard.tsx`、`web/src/pages/AlbumResults.tsx`、`web/src/styles/components.css`；测试 `web/tests/lookup.test.mjs`

## 出现的问题
用户希望查询时能看出每条结果来自哪个资料库。原来专辑行完全不写来源，封面角标的「iTunes / CAA」其实只是封面来源，容易被当成资料来源；版本卡片折叠时不写来源，展开后也只在有合并来源时才出现「资料来源」一行。

## 怎么解决的
专辑行与版本卡片在文字下方加资料库小标签，主来源在前，合并进来的同一版本随后（去重）。版本卡片展开后总显示「资料来源 X ↗」，可点到原页。卡片的来源名改由候选 id 判断（`sourceOf`），不再依赖 releaseInfo 里的身份字段。

## 验证
前端 194 项（新增 `candidateSources`）、tsc、build。样例数据下文字搜索「Meddle」（MusicBrainz 忙时只有 Discogs、空闲时 MusicBrainz 两种情况都试过）、条码 603497914999 查到 Discogs 版本，标签与展开行都正确；手机尺寸截图无溢出。没找到现成的多库合并实例做截图，合并顺序由单元测试覆盖。

## 可能带来的新问题
每张卡片多一行，结果列表略长。
