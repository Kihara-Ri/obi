# 2026-10-23 · 安卓沉浸展示：再次加强隐藏系统栏

- **作者**：Claude
- **范围**：`android/.../MainActivity.java`、`CHANGELOG.md`

## 改了什么
`applyImmersive` 改成与游戏 / 视频应用同一套：`FLAG_FULLSCREEN`、`WindowInsetsController.hide`、旧式 `systemUiVisibility`（FULLSCREEN + HIDE_NAVIGATION + IMMERSIVE_STICKY）三者同时设；刘海区在 R+ 用 `LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS`（横屏也铺到刘海侧）；进入后 400ms / 1.5s 各再确认一次；insets 监听发现系统栏回来时只重复隐藏（`reassertImmersive`），不再整体重走。退出沉浸会清掉 `FLAG_FULLSCREEN`。

## 出现的问题
v3.6.33 后用户反馈仍有系统栏常驻、占用高度（横屏）。

## 怎么解决的
见上。上一版只用了 `InsetsController`，部分 ROM 只认旧式标志或在延迟后回写系统栏状态。原因依然是推断，没有真机复现。

## 可能带来的新问题
- 需要安装新的 APK 才生效（Java 改动，网页热更新不带）；未在真机验证。
- 旧式标志已弃用，但与新接口并存无冲突。
