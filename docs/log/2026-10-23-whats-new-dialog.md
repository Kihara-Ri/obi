# 2026-10-23 · 更新后首次打开弹出更新说明

- **作者**：Claude
- **范围**：`web/src/core/whats-new.ts`（新）、`web/src/components/WhatsNew/`（新）、`App.tsx`、`wasm.d.ts`、`vite.config.ts`、`components/REGISTRY.md`、`CHANGELOG.md`

## 改了什么
应用加载后，若 `state.service.version` 比 localStorage 里记的「已看到的版本」新，就用原生 `<dialog>` 弹出更新说明：条目取自构建时打进包里的 `CHANGELOG.md`（动态 import `?raw`，单独 chunk），列出上次版本之后、不超过当前版本的最多 4 个版本。点「知道了」/ Esc 记下当前版本。首次安装（无记录）只记录不弹；版本号为 `dev` 或解析不出时不弹。

## 出现的问题
更新后用户不知道改了什么。

## 怎么解决的
见上。Chromium 手机尺寸用模拟版本号验证：旧版本 → 弹窗列出新条目 → 关闭后记下 → 刷新不再弹。

## 可能带来的新问题
- 弹窗内容就是 CHANGELOG 原文，写得偏技术的条目用户会原样看到，后续写 CHANGELOG 要面向用户。
- 弹窗 chunk 约 63KB（整份 CHANGELOG），只在版本变化时才加载。
- 本机模式（安卓）若 `state.service.version` 不存在则不弹；未在安卓真机验证。
