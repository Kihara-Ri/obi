# 2026-10-24 · 折叠区收起结束时抖一下

- **作者**：Claude
- **范围**：`components/ui/Details/Details.tsx`、`styles/drawer.css`、`styles/artists.css`、`forms/ListingForm.css`

## 出现的问题
`Details` 收起时高度动画到 0 后才摘掉原生 `open`，而标题下的 8px / 10px 间距写在 `details[open] summary`，在摘掉的那一帧瞬间消失，内容下方整体上跳一下。

## 怎么解决的
`Details` 增加随逻辑状态变化的 `.is-open` 类；这些间距改挂 `.is-open`，并给 summary 加 margin-bottom 过渡（时长、缓动与高度动画一致），收起过程中间距一起收，摘掉 `open` 时没有可见变化。

## 可能带来的新问题
无已知。`Collapse`（候选封面列表）结构不同，未改。
