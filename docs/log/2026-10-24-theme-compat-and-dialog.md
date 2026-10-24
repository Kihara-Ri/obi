# 2026-10-24 · 华为 nova 7 强制深色 / 切换失效；更新说明按钮文字不可见；手机去聚焦框

- **作者**：Claude
- **范围**：`web/src/styles/tokens.css`、`static/theme.js`（注释）、`components/WhatsNew/WhatsNew.css`、`styles/base.css`

## 出现的问题
1. nova 7 默认深色，设置里切浅色无效。
2. 「更新说明」弹窗的「知道了」按钮在深色下是黄底黄字，文字看不见，按钮外还有一圈黄色聚焦框。

## 原因
1. 主题 token 写在 `@supports (color:light-dark(...))` 里，基线是深色。nova 7 的系统 WebView 版本较旧，不认 `light-dark()`：整块声明被丢弃，只剩深色基线，`data-theme` 与 `prefers-color-scheme` 都管不到颜色，所以永远深色。
2. 按钮文字用的是 `--accent-text`（「强调色当文字」，深色下是黄），而不是黄底上的 `--accent-ink`。聚焦框来自弹窗 `autoFocus` 触发的 `:focus-visible`。

## 怎么解决的
1. token 改成普通声明三段：浅色默认；`@media (prefers-color-scheme:dark)` 里非显式浅色时用深色；`[data-theme=dark]` 显式深色。不再使用 `light-dark()`，旧 WebView 也能解析。
2. 按钮文字改 `--accent-ink`；触屏（`hover:none` 且 `pointer:coarse`）下全局关闭 `:focus-visible` 描边。

## 可能带来的新问题
触屏下接外接键盘的用户看不到聚焦位置；token 现在每个主题 token 写了三遍（浅/系统深/显式深），改颜色要三处同步。
