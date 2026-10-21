# 2026-10-21 · 抽屉下拉时背景逐渐清晰

- **作者**：Claude
- **范围**：`web/src/components/ui/Drawer.tsx`、`web/src/styles/drawer.css`

## 现象
手机抽屉按住头部（或左缘右滑）下拉时，背后页面的模糊与压暗纹丝不动，松手收回才一并消失。

## 改动
`#panel::before`（遮罩 + 模糊）的透明度读 `--scrim-o`；下拉时 Drawer 按位移 / sheet 高度把它从 1 降到 0，回弹则带 .26s 过渡复位；关闭时 `#panel.is-closing` 淡到 0。

## 验证
类型检查与构建通过。**没有在真机验证**（需触屏拖动），请在手机上看下拉过程中背景是否随之变清晰。
