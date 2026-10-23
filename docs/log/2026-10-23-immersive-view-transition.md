# 2026-10-23 · 沉浸展示进出过渡

- **作者**：Claude
- **范围**：`web/src/core/view-swap.ts`（新）、`hooks/useImmersive.ts`、`styles/gallery.css`、`CHANGELOG.md`

## 改了什么
`viewSwap(apply)`：切换前挑出最靠近视口中心的 `.gallery-artwork` 作主角，起 `document.startViewTransition`，在回调里 `flushSync` 提交沉浸状态，再按封面图片地址在新布局里找到同一张并命名为 `gallery-hero`，浏览器自动做位置与尺寸的形变，其余内容交叉淡化。`useImmersive` 的进入、退出、Esc / 系统退出全屏都走它；全屏请求仍同步发起（需用户手势）。

## 出现的问题
进出沉浸时布局瞬间重排，是硬切。

## 怎么解决的
见上；本地 Chromium 手机尺寸逐帧截图确认封面从原位置移向新位置，退出后无残留 view-transition-name。

## 可能带来的新问题
- 不支持 View Transitions（旧 iOS）或减少动态时仍是硬切。
- 3D 模式（轨道、胶片等）里封面带 transform，形变轨迹可能不是直线；封面图片地址相同的多张只取靠近中心的一张。
- 桌面浏览器真全屏时视口尺寸变化与过渡同时进行。

## 关联
2026-10-23-immersive-fullscreen-nav-cleanup.md
