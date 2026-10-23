# 2026-10-23 · 右划返回：露出上一级、元素全部跟手、返回后不闪

- **作者**：Claude
- **范围**：`web/src/components/PeekUnderlay.tsx`（新）、`hooks/useEdgeSwipeBack.ts`、`hooks/usePageTransition.ts`、`App.tsx`、`styles/pagetransition.css`、`styles/layout.css`、`CHANGELOG.md`

## 改了什么
1. 位移改用独立的 `translate` 属性，并同时覆盖「单个根含顶栏」与「并列片段（标题 / 段落 / 表格直接挂在 page-layer 下）」两种页面结构；此前账本等页的并列元素没有跟着动。
2. 新增 `PeekUnderlay`：手势开始时通过 `obi-peek` 事件挂载上一级页面（更多 / 设置）作为垫底层（固定、裁剪、不可交互、顶栏隐藏），几何与 `#main` 共用规则；内容侧有一块随内容右移的不透明底板（`.page-layer::before`），避免垫底页从内容缝隙透出来。
3. 返回提交时垫底页保持可见，直到新页提交；`swipeBack` 标记让 `usePageTransition` 跳过快照淡出 / 淡入，不再闪。

## 出现的问题
首版右划返回看不到上一级、部分元素不动、完成后上一级闪一下。

## 怎么解决的
见上。Chromium 手机尺寸 CDP 触摸验证：交易记录、账本、设置、查询四页拖动时所有非顶栏元素都右移 192px，左侧露出「更多」；松手后 hash 回到 #more，期间无快照层（ghost）。

## 可能带来的新问题
- 垫底页是第二份页面实例，仅手势期间存在；`inert` 保证不抢焦点。
- 没有在 iOS / 安卓真机验证手感与是否仍有闪烁。
