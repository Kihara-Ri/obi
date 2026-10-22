# 2026-10-23 · 编辑页封面点开放大（复用 useArtExpand）

- **作者**：Claude
- **范围**：`components/ReleaseCandidateCard/useArtExpand.ts`、`ReleaseCandidateCard.tsx/.css`（ReleaseSummary）、`forms/record/CoverPanel.tsx`、`styles/drawer.css`、`CHANGELOG.md`

## 改了什么
useArtExpand 参数化（泛型 head 元素 + 随封面移动的元素选择器，默认含 `.rcc-source`）；ReleaseSummary 的头部封面接入它；CoverPanel 候选行抽成 `CoverPick`，点缩略图放大。放大样式与查询页卡片共用一组 `.is-big` 规则。

## 出现的问题
用户反馈：编辑页左上封面和下面候选封面不能像查询页那样展开放大。

## 怎么解决的
不另写第二套动画，直接复用查询页的 FLIP 展开逻辑。候选行是整行「使用」按钮，缩略图点击单独触发放大、其余区域仍是选用；放弃了 Lightbox 弹窗方案（与查询页体验不一致）。

## 可能带来的新问题
放大时用的仍是缩略图地址（250px），铺到约 306–420px 宽会略糊；未做大图切换。仅 Playwright 验证，未在真机验证。

## 关联
2026-10-22-cover-burn-reveal.md
