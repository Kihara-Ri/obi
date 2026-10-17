# 2026-10-17 · 切换主题整页淡化

- **作者**：Claude
- **范围**：`static/theme.js` `static/sw.js` `styles/base.css`

## 改了什么
主题切换优先使用 View Transitions 整页交叉淡化（0.5s）；不支持或减少动态效果时退回逐元素颜色过渡（.3s → .5s，ease-in-out）；`.theme-fade` 的通配 `!important` 不再顶掉分段滑块与开关旋钮的位移过渡；Service Worker 缓存版本 v21 → v22。

## 出现的问题
切主题「啪」一下变；外观分段的滑块没有动画。

## 怎么解决的
见上。

## 可能带来的新问题
View Transitions 期间页面约 0.5s 内不可点，外观分段的滑块随整页淡化而不是单独滑动。

## 关联
见同日期其他日志
