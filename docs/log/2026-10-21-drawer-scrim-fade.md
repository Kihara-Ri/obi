# 2026-10-21 · 抽屉下拉时背景逐渐清晰

- **作者**：Claude
- **范围**：`web/src/components/ui/Drawer.tsx`、`web/src/styles/drawer.css`

## 现象
手机抽屉按住头部（或左缘右滑）下拉时，背后页面的模糊与压暗纹丝不动，松手收回才一并消失。

## 改动
`#panel::before`（遮罩 + 模糊）的透明度读 `--scrim-o`；下拉时 Drawer 按位移 / sheet 高度把它从 1 降到 0，回弹则带 .26s 过渡复位；关闭时 `#panel.is-closing` 淡到 0。

## 验证
类型检查与构建通过。**没有在真机验证**（需触屏拖动），请在手机上看下拉过程中背景是否随之变清晰。

## 追加：左缘手势（二级页跟手返回 / 禁止整页横推）
- 真机截图：左缘右滑时 iOS 系统的整页「返回」滑动与我们的下拉叠在一起（整页右推 + sheet 下拖），二级页返回则是整个 sheet 连标题一起被推走。
- 改动：左缘起手在 `touchstart` 就 `preventDefault` 拦系统手势（原先只在 touchmove 拦，系统手势已起步）；二级页右滑改为只拖标题线以下的页面层，下层视差露出，松手 pop 动画从手指位置接着播，被拒（脏表单取消）则回弹。
- **未在真机验证**。`touchstart` 拦截是业界通行办法，但新版 iOS 若仍让系统手势优先，需要改为不压历史守卫条目的方案。副作用：左缘 28px 窄条内不再产生点击 / 原生滚动。

## 追加：禁止页面双指缩放
真机双指捏合会缩放整页，布局错位、fixed 抽屉抽搐。`viewport` 加 `maximum-scale=1,user-scalable=no`（主页、登录页、离线页）；`html{touch-action:pan-x pan-y}`（去掉 pinch-zoom 与双击缩放）；`main.tsx` 拦 `gesturestart`（iOS Safari 无视 user-scalable，只认这个）。灯箱捏合走 pointer 事件，不受影响。**未真机验证**；展示页个别元素原声明的 `touch-action:pinch-zoom` 现被 html 的交集规则覆盖。
