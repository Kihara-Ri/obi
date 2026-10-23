# 2026-10-23 · 子页右划返回只动内容

- **作者**：Claude
- **范围**：`web/src/hooks/useEdgeSwipeBack.ts`（新）、`hooks/usePageTransition.ts`、`core/nav.ts`、`styles/pagetransition.css`、`CHANGELOG.md`

## 改了什么
1. `useEdgeSwipeBack(page)`：在有返回目标的子页上监听起点距左缘 28px 内的触摸，水平拖动时给 `#main` 加 `.is-swiping` 并更新 `--swipe-dx`；CSS 只位移 `.page-layer>*>:not(.page-head)`（内容），顶栏与底栏不动。松手拖过屏宽 33% 或速度 >0.5px/ms：内容滑出后 `navigate(back.href)`；否则弹回。抽屉 / 灯箱打开时不响应，竖向滑动不抢。
2. `core/nav.ts`：iOS（含触屏 iPad）不再给子页压历史，避免系统返回手势把整屏快照滑走；安卓仍压（返回键需要）。
3. hook 挂在 `usePageTransition` 里（App.tsx 已到 200 行）。

## 出现的问题
上一版给子页压历史后，iOS 系统边缘右划播放的是整屏快照滑动，顶栏和底栏跟着一起走，与应用「顶栏留在原地」的统一风格冲突。网页无法定制系统手势的动画，只能不让系统手势生效、自己实现。

## 怎么解决的
见上。Chromium 手机尺寸用 CDP 合成触摸验证：拖动时顶栏 / 底栏不动、内容跟手；松手后滑出并回到「更多」。

## 可能带来的新问题
- iOS 上子页没有历史条目：系统右划无反应，只有自己的手势和顶栏返回键；Safari 的左缘右划起点若被系统抢先，手势不触发。
- 起点必须在左缘 28px 内；内容里有横向滚动区域时不受影响（只认左缘起手）。
- 没有在 iOS 真机验证手势手感。

## 关联
2026-10-23-more-subpage-history.md
