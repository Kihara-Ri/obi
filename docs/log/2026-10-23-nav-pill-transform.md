# 2026-10-23 · 底栏切换更流畅（胶囊改用 transform）

- **作者**：Claude
- **范围**：`components/AppNav.tsx`、`styles/layout.css`、`CHANGELOG.md`

## 改了什么
底栏胶囊原先动画 `left` / `width`（每帧布局 + 重绘，且在 backdrop-filter 玻璃条上）。胶囊宽度其实恒为激活权重占比，只有位置变，现改为固定 `left`、用 `transform: translateX` 平移（合成器线程），并加 `will-change: transform`；底栏加 `contain: layout style`，把列宽过渡的布局限制在底栏内。

## 出现的问题
用户反馈真机切换底栏时有点卡：换页渲染（克隆旧页快照、挂新页）占满主线程，依赖主线程的 left/width 动画跟着掉帧。

## 怎么解决的
让最显眼的胶囊滑动不再依赖主线程；列宽 / 标签展开仍是布局动画，但范围已被 contain 限在底栏。胶囊与列的对齐在切换 4 个标签后实测偏差为 0。

## 可能带来的新问题
标签文字展开（max-width）仍走主线程，换页极重时仍可能轻微不顺；未真机验证。若仍卡，下一步是把换页内容渲染延后到胶囊动画之后。

## 关联
无
