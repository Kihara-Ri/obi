# 2026-10-24 · 封面聚焦过渡：圆角不再骤变

- **作者**：Claude
- **范围**：`web/src/core/gallery-zoom.ts`、`web/src/components/GalleryFocus.tsx`、`CHANGELOG.md`

## 出现的问题
点开封面时，过渡用的临时封面图（proxy）是直角的，动画结束换成真正的聚焦卡片（`.album-flip-face`，13px 圆角）时圆角突然出现。收回时反过来。

## 怎么解决的
`coverRectFrames` 增加可选的圆角起止值，proxy 在放大 / 收回时把 `border-radius` 与位置、尺寸一起动画：缩略图 2px ↔ 聚焦卡片 13px（常量 `THUMB_RADIUS` / `FOCUS_RADIUS`）。收回时若打断了正在进行的放大，从 proxy 当前的实际圆角起步。

## 验证
tsc 与测试通过；本地浏览器里点封面没能触发灯箱，没有看到动画本身，需在真机确认。

## 可能带来的新问题
圆角用 px 常量；若聚焦卡片或缩略图的圆角以后改动，要同步改这两个常量。
