# 2026-10-23 · 详情封面放大只变宽不变高（iOS）

- **作者**：Claude
- **范围**：`styles/drawer.css`、`CHANGELOG.md`

## 改了什么
放大态下，封面容器 `align-self:flex-start`，内部 img / 占位改为 `width:100%;height:auto;aspect-ratio:1`，由内容自己撑出方形高度。

## 出现的问题
真机（iOS）上详情封面放大后只横向变宽、高度仍是 96px，成了横条。

## 怎么解决的
原写法只靠 flex 项容器上的 `aspect-ratio`，iOS Safari 在 flex 换行项上不认；改为内容撑高，不依赖容器的 aspect-ratio。Chromium 与 WebKit（Playwright）下都是正方形。

## 可能带来的新问题
未在真机复测；放大中的高度过渡沿用 useArtExpand 的量测。

## 关联
2026-10-23-detail-cover-zoom.md
