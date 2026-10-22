# 2026-10-23 · 主按钮忙碌态 + 展示页触发按钮样式

- **作者**：Claude
- **范围**：`web/src/styles/components.css`、`styles/gallery.css`、`pages/GalleryPage.tsx`、各表单提交按钮（加 `aria-busy`）、`CHANGELOG.md`、`docs/KNOWN-ISSUES.md`

## 改了什么
I-014：禁用的 `button.primary` 保持黄色底；处理中（`aria-busy=true`）显示转圈 + 流光。I-015：展示页范围 / 方式按钮去掉下拉小箭头，改「范围 / 方式」小标签；展示设置改用齿轮图标。

## 出现的问题
`button:disabled:hover` 把背景刷成 surface-2，触屏点按后 hover 残留，主按钮（深色文字）整体变深色；这三个展示页按钮实际打开的是抽屉面板，小箭头误导。

## 怎么解决的
给 primary 的 disabled / disabled:hover 单独声明黄色底；忙碌态用 CSS 伪元素做转圈和流光，不改按钮结构；在已有 `saving` / `busy` 状态的主按钮上加 `aria-busy`。流光用 `--accent-strong` 令牌，减少动画偏好下关闭流光。

## 可能带来的新问题
仅部分带 saving 状态的提交按钮接入了 aria-busy，其余零星主按钮（如 ModuleChooser、导入、绑定艺人）只会保持黄色禁用，无转圈。仅 Playwright 验证，未在真机验证。

## 关联
I-014 · I-015
