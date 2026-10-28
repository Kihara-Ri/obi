# 2026-10-28 · 单张复制反馈与生成设置合并

- **作者**：Claude
- **范围**：`ListingPhotos`、`core/photo-clipboard.ts`、`ListingPreferences`、`ListingOptions`、`components/ui/Details`、`ListingForm.css`、`tests/browser/listing-acceptance.mjs`、使用说明 / REGISTRY / CHANGELOG

## 改了什么
- 单张复制不再等所有照片预取完才可点：已预取用现成文件，否则点击时当场取这一张，`ClipboardItem` 直接接收 Promise，保留点击手势。
- 复制中只忽略连点，不再给所有缩略图按钮设 `disabled`（原先任意一张复制，其余按钮同时变灰再恢复，看起来闪烁）。
- 复制成功：按钮变绿底对勾（弹出 + 描边绘制）、缩略图边框一圈淡出，约 1.6 秒后复原；减少动态效果下无动画。
- 「生成设置」去掉嵌套的「自定义预设」与「编辑预设」：文案风格只有一个下拉（内置 / 自定义 / ＋新建），选中自定义就地编辑「风格名称、写作要求」，保存修改 / 删除风格；「本次补充」标明只用于这一次。

## 出现的问题
- 新建风格时编辑区压在「已发布」行上、滚不到底：共享组件 `Details` 展开动画用 `fill:forwards` 把高度锁在展开瞬间的值，之后内容变高就被截断。改为展开动画结束后 `cancel()`，高度回到自动。这是旧 bug，别处的 Details 只是内容不会在展开后变高所以没暴露。
- 同时给 `.listing-body` 子项加 `flex-shrink:0`，防止 Collapse 的 0 最小高度让区块被压缩。

## 怎么解决的
见上。被放弃的方案：保留嵌套 Details 只改文案——重复入口（风格 / 自定义 / 编辑 / 写作要求）本身是问题，所以合并。

## 可能带来的新问题
- 点击当场取原图：4G 下大图第一次点会有等待，期间按钮显示转圈（骨架已让缩略图加载过，浏览器缓存通常命中）。
- 删除自定义风格后默认回到「简洁直售」；旧的「自定义预设」入口文案不再存在。
- 已验证：Chromium 390 宽复制写入 `image/png`、复制过程 disabled 属性零变化、✅ 状态与复原、新建风格布局；`listing-acceptance.mjs` 的预设步骤已改为新流程，但该脚本后半段依赖联网下载的参考照片，本机没跑到那一步。真机剪贴板与 Safari 手势未验。

## 关联
2026-10-28-listing-panel-polish.md · 2026-10-28-listing-back-readme.md
